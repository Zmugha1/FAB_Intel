import { useState } from "react";
import { PageProps } from "../App";
import { call, Contact, Invoice } from "../ipc";
import { BUSINESSES, STATUS, addDays, bizName, money, toCents, today } from "../format";
import { useLoad } from "./useLoad";

type Form = { id: number; contact_id: number; business: string; amount: string; repeat: string; due_date: string; pay_via: string; notes: string };

export default function Invoices({ user, biz, changed }: PageProps) {
  const { data, error, reload } = useLoad<Invoice[]>("invoices_list", { today: today() });
  const contacts = useLoad<Contact[]>("contacts_list");
  const [form, setForm] = useState<Form | null>(null);
  const [msg, setMsg] = useState("");
  const mine = BUSINESSES.filter(([k]) => user.businesses.includes(k));
  const list = (data ?? []).filter((i) => biz === "all" || i.business === biz);
  const unpaid = list.filter((i) => i.status === "sent").reduce((s, i) => s + i.amount_cents, 0);
  const overdue = list.filter((i) => i.overdue_days > 0);

  const save = async () => {
    if (!form) return;
    const cents = toCents(form.amount);
    if (cents === null) return setMsg("Enter the amount in dollars.");
    try {
      await call("invoice_save", { invoice: { id: form.id, contact_id: form.contact_id, business: form.business, amount_cents: cents, repeat: form.repeat, due_date: form.due_date, pay_via: form.pay_via, notes: form.notes } });
      setForm(null);
      setMsg("");
      reload();
      changed();
    } catch (e) {
      setMsg((e as Error).message);
    }
  };
  const act = (id: number, action: string) => call("invoice_action", { id, action }).then(() => { reload(); changed(); }).catch((e: Error) => setMsg(e.message));

  return (
    <>
      <div className="hd">
        <span className="eyebrow">1.4 Invoices and payments</span>
        <h1>Invoices</h1>
        <p className="sub">A won quote becomes the invoice. Payment links and status from Stripe and Square connect when your accounts are linked.</p>
      </div>
      {error && <p className="err">{error}</p>}
      <div className="grid g4">
        <div className="card kpi"><span className="v">{money(unpaid)}</span><span className="l">Sent, not paid</span></div>
        <div className="card kpi"><span className="v">{overdue.length}</span><span className="l">Overdue</span></div>
        <div className="card kpi"><span className="v">{list.filter((i) => i.repeat !== "none" && i.status !== "void").length}</span><span className="l">Repeating (monthly, annual)</span></div>
      </div>
      <div className="row"><button className="btn" disabled={!contacts.data?.length} onClick={() => setForm({ id: 0, contact_id: 0, business: biz !== "all" ? biz : mine[0][0], amount: "", repeat: "none", due_date: addDays(today(), 15), pay_via: "", notes: "" })}>New invoice</button></div>
      {msg && <p className="err" role="alert">{msg}</p>}
      {form && (
        <div className="card form">
          <h2>New invoice</h2>
          <div className="f2">
            <div className="f"><label>Contact</label>
              <select className="in" value={form.contact_id} onChange={(e) => setForm({ ...form, contact_id: Number(e.target.value) })}>
                <option value={0}>Pick a contact</option>
                {contacts.data?.map((c) => <option key={c.id} value={c.id}>{c.name}{c.company ? ", " + c.company : ""}</option>)}
              </select>
            </div>
            <div className="f"><label>Business</label><select className="in" value={form.business} onChange={(e) => setForm({ ...form, business: e.target.value })}>{mine.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></div>
            <div className="f"><label>Amount</label><input className="in" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
            <div className="f"><label>Due</label><input type="date" className="in" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
            <div className="f"><label>Repeats</label><select className="in" value={form.repeat} onChange={(e) => setForm({ ...form, repeat: e.target.value })}><option value="none">No</option><option value="monthly">Monthly</option><option value="annual">Annual</option></select></div>
            <div className="f"><label>Paid by</label><select className="in" value={form.pay_via} onChange={(e) => setForm({ ...form, pay_via: e.target.value })}><option value="">Not chosen</option><option>Stripe</option><option>Square</option><option>Zelle</option><option>Check</option></select></div>
          </div>
          <div className="row"><button className="btn" onClick={save}>Save draft</button><button className="btn ghost" onClick={() => setForm(null)}>Cancel</button></div>
        </div>
      )}
      <div className="card scroll">
        <table className="tbl">
          <thead><tr><th>Invoice</th><th>Contact</th><th>Business</th><th className="num">Amount</th><th>Due</th><th>Repeats</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {list.map((i) => (
              <tr key={i.id}>
                <td>{i.number} {i.sample && <span className="pill hold">Sample</span>}</td>
                <td>{i.contact}</td><td>{bizName(i.business)}</td>
                <td className="num">{money(i.amount_cents)}</td>
                <td>{i.due_date}{i.overdue_days > 0 && <> <span className="pill warn">{i.overdue_days} days late</span></>}</td>
                <td>{i.repeat === "none" ? "" : i.repeat}</td>
                <td><span className={"pill " + (STATUS[i.status]?.[1] ?? "")}>{STATUS[i.status]?.[0] ?? i.status}</span></td>
                <td className="row">
                  {i.status === "draft" && <button className="btn ghost" onClick={() => act(i.id, "mark_sent")}>Mark sent</button>}
                  {i.status === "sent" && <button className="btn ghost" onClick={() => act(i.id, "mark_paid")}>Mark paid</button>}
                  {user.role === "owner" && (i.status === "draft" || i.status === "sent") && <button className="btn ghost" onClick={() => act(i.id, "void")}>Void</button>}
                </td>
              </tr>
            ))}
            {data && list.length === 0 && <tr><td colSpan={8} className="muted">No invoices yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
