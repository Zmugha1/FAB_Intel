import { useState } from "react";
import { PageProps } from "../App";
import { call, Contact, Line, Quote, Rules } from "../ipc";
import { BUSINESSES, STATUS, addDays, bizName, money, pct, toCents, today, when } from "../format";
import { liveTotals } from "./quoteMath";
import { useLoad } from "./useLoad";
import { Tip } from "../Tip";

/** The checklist from the STZ interview. Keys match the backend. */
export const CHECKLIST: [string, string][] = [
  ["shipping", "Shipping added"],
  ["less_than_minimum", "Less-than-minimum charge checked"],
  ["color_changes", "Color changes checked"],
  ["setup_fees", "Setup fees added"],
  ["in_hands", "In-hands date confirmed"],
  ["art", "Art received"],
];

type Draft = { id: number; contact_id: number; business: string; lines: LineText[]; checklist: Record<string, boolean>; notes: string; requested: string; status: string };
type LineText = { item: string; vendor: string; decoration: string; qty: string; cost: string; price: string; taxable: boolean };

const blankLine = (): LineText => ({ item: "", vendor: "", decoration: "", qty: "", cost: "", price: "", taxable: true });
const toText = (l: Line): LineText => ({ item: l.item, vendor: l.vendor, decoration: l.decoration, qty: String(l.qty), cost: (l.unit_cost_cents / 100).toFixed(2), price: (l.unit_price_cents / 100).toFixed(2), taxable: l.taxable });

function parseLines(lines: LineText[], costsHidden: boolean): Line[] | string {
  const out: Line[] = [];
  for (const [i, l] of lines.entries()) {
    if (!l.item.trim() && !l.qty && !l.cost && !l.price) continue;
    const qty = Number(l.qty);
    const cost = costsHidden ? 0 : toCents(l.cost);
    const price = toCents(l.price);
    if (!l.item.trim() || !Number.isInteger(qty) || qty <= 0 || cost === null || price === null) return costsHidden ? `Line ${i + 1} needs an item, a whole quantity and a price.` : `Line ${i + 1} needs an item, a whole quantity, a cost and a price.`;
    out.push({ item: l.item, vendor: l.vendor, decoration: l.decoration, qty, unit_cost_cents: cost, unit_price_cents: price, taxable: l.taxable });
  }
  return out;
}

const dateOf = (unix: number | null) => (unix ? today(new Date(unix * 1000)) : "");
const unixOf = (date: string) => (date ? Math.floor(new Date(date + "T12:00:00").getTime() / 1000) : null);

export default function Quotes({ user, biz, changed }: PageProps) {
  const quotes = useLoad<Quote[]>("quotes_list");
  const contacts = useLoad<Contact[]>("contacts_list");
  const rules = useLoad<Rules>("rules_get");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [open, setOpen] = useState<Quote | null>(null);
  const [msg, setMsg] = useState("");
  const mine = BUSINESSES.filter(([k]) => user.businesses.includes(k));
  const costsHidden = user.role !== "owner" && rules.data?.staff_see_costs === false;
  const list = (quotes.data ?? []).filter((q) => biz === "all" || q.business === biz);

  const refresh = (id?: number) => {
    quotes.reload();
    changed();
    if (id) call<Quote[]>("quotes_list").then((all) => setOpen(all.find((q) => q.id === id) ?? null));
  };

  const startNew = () => {
    setOpen(null);
    setMsg("");
    setDraft({ id: 0, contact_id: 0, business: biz !== "all" ? biz : mine[0][0], lines: [blankLine()], checklist: {}, notes: "", requested: today(), status: "draft" });
  };
  const startEdit = (q: Quote) => {
    setMsg("");
    setDraft({ id: q.id, contact_id: q.contact_id, business: q.business, lines: q.lines.map(toText), checklist: q.checklist ?? {}, notes: q.notes, requested: dateOf(q.requested_at), status: q.status });
  };

  const save = async () => {
    if (!draft) return;
    setMsg("");
    const lines = parseLines(draft.lines, costsHidden);
    if (typeof lines === "string") return setMsg(lines);
    try {
      const id = await call<number>("quote_save", { quote: { id: draft.id, contact_id: draft.contact_id, business: draft.business, lines, checklist: draft.checklist, notes: draft.notes, requested_at: unixOf(draft.requested) } });
      setDraft(null);
      refresh(id);
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  const act = async (q: Quote, action: string) => {
    setMsg("");
    try {
      if (action === "invoice") await call("invoice_from_quote", { quoteId: q.id, dueDate: addDays(today(), 15) });
      else if (action === "project") await call("project_from_quote", { quoteId: q.id });
      else await call("quote_action", { id: q.id, action });
      setMsg(action === "invoice" ? "Draft invoice made. Open Invoices to send it." : action === "project" ? "Project made. Open Projects and artwork." : "");
      refresh(q.id);
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  const live = draft && rules.data ? liveTotals(draft.lines, rules.data, user.role === "staff", costsHidden) : null;
  const setLine = (i: number, patch: Partial<LineText>) => draft && setDraft({ ...draft, lines: draft.lines.map((l, n) => (n === i ? { ...l, ...patch } : l)) });

  return (
    <>
      <div className="hd">
        <span className="eyebrow">1.3 Quotes</span>
        <h1>Quotes</h1>
        <p className="sub">
          {costsHidden
            ? <>Live totals and tax. Owner approves over {money(rules.data?.approve_over_cents)}{rules.data?.staff_quotes_need_owner ? ", and every staff quote goes to the owner." : "."}</>
            : <>Live margin and tax. Floor {pct(rules.data?.margin_floor_bp)}, owner approves over {money(rules.data?.approve_over_cents)}{rules.data?.staff_quotes_need_owner ? ", and every staff quote goes to the owner." : "."}</>}
          {rules.data && rules.data.tax_rate_bp === null && " Sales tax is not set yet."}
        </p>
      </div>
      {(quotes.error || contacts.error) && <p className="err">{quotes.error || contacts.error}</p>}
      {msg && <p className={msg.startsWith("Draft invoice") || msg.startsWith("Project made") ? "okmsg" : "err"} role="alert">{msg}</p>}
      <div className="row"><button className="btn" onClick={startNew} disabled={!contacts.data?.length}>New quote</button>{contacts.data?.length === 0 && <span className="muted">Add a contact first.</span>}</div>

      {draft && (
        <div className="card form">
          <h2>{draft.status === "waiting_approval" ? "Check costs before approving" : draft.id ? "Edit draft" : "New quote"}</h2>
          {costsHidden && <p className="muted">Enter prices only. The owner adds and checks costs when the quote comes for approval.</p>}
          <div className="f2">
            <div className="f"><label>Contact</label>
              <select className="in" value={draft.contact_id} onChange={(e) => setDraft({ ...draft, contact_id: Number(e.target.value) })}>
                <option value={0}>Pick a contact</option>
                {contacts.data?.map((c) => <option key={c.id} value={c.id}>{c.name}{c.company ? ", " + c.company : ""}</option>)}
              </select>
            </div>
            <div className="f"><label>Business</label>
              <select className="in" value={draft.business} onChange={(e) => setDraft({ ...draft, business: e.target.value })}>
                {mine.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
              </select>
            </div>
            <div className="f"><label>Request came in<Tip text="The day the customer asked for this quote. FAB Intel uses it to measure days from request to quote on the ROI page." /></label><input type="date" className="in" value={draft.requested} onChange={(e) => setDraft({ ...draft, requested: e.target.value })} /></div>
          </div>
          <div className="scroll lines">
            <table className="tbl">
              <thead><tr><th>Item</th><th>Vendor</th><th>Decoration</th><th className="num">Qty</th>{!costsHidden && <th className="num">Unit cost<Tip text="What the vendor charges you for one unit, decoration included. Used for margin. Customers never see it." /></th>}<th className="num">Unit price<Tip text="What the customer pays for one unit, before sales tax." /></th><th>Tax<Tip text="Ticked lines get your sales tax rate. Untick a line that is not taxable." /></th><th></th></tr></thead>
              <tbody>
                {draft.lines.map((l, i) => (
                  <tr key={i}>
                    <td><input className="in" value={l.item} onChange={(e) => setLine(i, { item: e.target.value })} aria-label="Item" /></td>
                    <td><input className="in" value={l.vendor} onChange={(e) => setLine(i, { vendor: e.target.value })} aria-label="Vendor" /></td>
                    <td><input className="in" value={l.decoration} onChange={(e) => setLine(i, { decoration: e.target.value })} aria-label="Decoration" /></td>
                    <td><input className="in" style={{ width: 70 }} value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} aria-label="Quantity" /></td>
                    {!costsHidden && <td><input className="in" style={{ width: 90 }} value={l.cost} onChange={(e) => setLine(i, { cost: e.target.value })} aria-label="Unit cost" /></td>}
                    <td><input className="in" style={{ width: 90 }} value={l.price} onChange={(e) => setLine(i, { price: e.target.value })} aria-label="Unit price" /></td>
                    <td><input type="checkbox" checked={l.taxable} onChange={(e) => setLine(i, { taxable: e.target.checked })} aria-label="Taxable" /></td>
                    <td><button className="btn ghost" onClick={() => setDraft({ ...draft, lines: draft.lines.filter((_, n) => n !== i) })} aria-label="Remove line">Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="row"><button className="btn ghost" onClick={() => setDraft({ ...draft, lines: [...draft.lines, blankLine()] })}>Add line</button></div>
          {live && (
            <div className="grid g4">
              <div className="card kpi"><span className="v">{money(live.subtotal)}</span><span className="l">Subtotal</span></div>
              <div className="card kpi"><span className="v">{live.tax === null ? "Not set" : money(live.tax)}</span><span className="l">Sales tax<Tip text={live.tax === null ? "Not set means the owner has not answered the sales tax question on the Rules page yet." : "Your rate times the lines with Tax ticked, rounded to the cent."} /></span></div>
              <div className="card kpi"><span className="v">{money(live.total)}</span><span className="l">Total</span></div>
              {!costsHidden && <div className="card kpi"><span className="v">{pct(live.margin)}</span><span className="l">Margin<Tip text="Subtotal minus vendor cost, divided by subtotal. Sales tax is left out. Under your floor, the quote goes to the owner." /></span></div>}
            </div>
          )}
          {live && live.reasons.length > 0 && <div className="callout hold">Goes to the owner: {live.reasons.join(" ")}<Tip text="These come from the rules on the Rules page. The quote can still be saved and submitted. It waits for the owner's approval before it can be sent." /></div>}
          <h3 className="sm">Before it goes out<Tip text="Your quote checklist from the STZ interview. Every box must be ticked before the quote can be submitted. Tick a box when it does not apply, and say why in Notes." /></h3>
          <div className="grid g3">
            {CHECKLIST.map(([k, label]) => (
              <label className="check" key={k}><input type="checkbox" checked={!!draft.checklist[k]} onChange={(e) => setDraft({ ...draft, checklist: { ...draft.checklist, [k]: e.target.checked } })} />{label}</label>
            ))}
          </div>
          <div className="f"><label>Notes</label><textarea className="in" rows={2} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></div>
          <div className="row"><button className="btn" onClick={save}>{draft.status === "waiting_approval" ? "Save costs" : "Save draft"}</button><button className="btn ghost" onClick={() => setDraft(null)}>Cancel</button></div>
        </div>
      )}

      {open && !draft && (
        <div className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2>{open.number} · {open.contact}</h2>
            <span className={"pill " + (STATUS[open.status]?.[1] ?? "")}>{STATUS[open.status]?.[0] ?? open.status}</span>
          </div>
          <p className="muted">{bizName(open.business)} · {open.lines.length} {open.lines.length === 1 ? "line" : "lines"} · total {money(open.totals.total_cents)}{!open.costs_hidden && <> · margin {pct(open.totals.margin_bp)}</>}</p>
          {open.needs_owner.length > 0 && open.status !== "won" && open.status !== "lost" && <div className="callout hold">{open.needs_owner.join(" ")}</div>}
          {open.open_checklist.length > 0 && <div className="callout warn">Checklist still open: {open.open_checklist.join(", ")}.</div>}
          <div className="row">
            {open.status === "draft" && <><button className="btn ghost" onClick={() => startEdit(open)}>Edit</button><button className="btn" onClick={() => act(open, "submit")}>Submit</button></>}
            {open.status === "waiting_approval" && user.role === "owner" && <><button className="btn" onClick={() => act(open, "approve")}>Approve</button><button className="btn ghost" onClick={() => startEdit(open)}>Check costs</button><button className="btn ghost" onClick={() => act(open, "back_to_draft")}>Send back to draft</button></>}
            {open.status === "approved" && <><button className="btn" onClick={() => act(open, "mark_sent")}>Mark sent</button>{user.role === "owner" && <button className="btn ghost" onClick={() => act(open, "back_to_draft")}>Back to draft</button>}</>}
            {open.status === "sent" && <><button className="btn" onClick={() => act(open, "won")}>Won</button><button className="btn ghost" onClick={() => act(open, "lost")}>Lost</button></>}
            {open.status === "won" && <><button className="btn" onClick={() => act(open, "invoice")}>Make invoice</button><button className="btn ghost" onClick={() => act(open, "project")}>Make project</button></>}
            <button className="btn ghost" onClick={() => setOpen(null)}>Close</button>
          </div>
        </div>
      )}

      <div className="card scroll">
        <table className="tbl">
          <thead><tr><th>Quote</th><th>Contact</th><th>Business</th><th className="num">Total</th>{!costsHidden && <th className="num">Margin</th>}<th>Status</th><th>Sent</th></tr></thead>
          <tbody>
            {list.map((q) => (
              <tr key={q.id} onClick={() => { setDraft(null); setOpen(q); }} style={{ cursor: "pointer" }}>
                <td>{q.number} {q.sample && <span className="pill hold">Sample</span>}</td>
                <td>{q.contact}</td>
                <td>{bizName(q.business)}</td>
                <td className="num">{money(q.totals.total_cents)}</td>
                {!costsHidden && <td className="num">{pct(q.totals.margin_bp)}</td>}
                <td><span className={"pill " + (STATUS[q.status]?.[1] ?? "")}>{STATUS[q.status]?.[0] ?? q.status}</span></td>
                <td>{when(q.sent_at)}</td>
              </tr>
            ))}
            {quotes.data && list.length === 0 && <tr><td colSpan={costsHidden ? 6 : 7} className="muted">No quotes yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
