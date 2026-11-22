import { useState } from "react";
import { PageProps } from "../App";
import { call, Contact } from "../ipc";
import { BUSINESSES, bizName } from "../format";
import { useLoad } from "./useLoad";

const blank = (biz: string[]): Contact => ({ id: 0, name: "", company: "", email: "", phone: "", businesses: biz, source: "", notes: "", sample: false });

export default function Contacts({ user, biz }: PageProps) {
  const { data, error, reload } = useLoad<Contact[]>("contacts_list");
  const dups = useLoad<[number, number, string][]>("contacts_duplicates");
  const [edit, setEdit] = useState<Contact | null>(null);
  const [msg, setMsg] = useState("");
  const [q, setQ] = useState("");
  const mine = BUSINESSES.filter(([k]) => user.businesses.includes(k));
  const list = (data ?? [])
    .filter((c) => biz === "all" || c.businesses.includes(biz))
    .filter((c) => (c.name + c.company + c.email + c.phone).toLowerCase().includes(q.toLowerCase()));

  const save = async () => {
    if (!edit) return;
    setMsg("");
    try {
      await call("contact_save", { contact: edit });
      setEdit(null);
      reload();
      dups.reload();
    } catch (e) {
      setMsg((e as Error).message);
    }
  };
  const toggle = (k: string) => edit && setEdit({ ...edit, businesses: edit.businesses.includes(k) ? edit.businesses.filter((b) => b !== k) : [...edit.businesses, k] });
  const byId = (id: number) => data?.find((c) => c.id === id)?.name ?? `#${id}`;

  return (
    <>
      <div className="hd">
        <span className="eyebrow">1.2 Contacts</span>
        <h1>One contact list, three businesses</h1>
        <p className="sub">WurkHub owns every contact. Each one is tagged with the businesses it buys from.</p>
      </div>
      {error && <p className="err">{error}</p>}
      {(dups.data?.length ?? 0) > 0 && (
        <div className="callout hold">
          Possible duplicates: {dups.data!.map(([a, b, why]) => `${byId(a)} and ${byId(b)} (${why})`).join("; ")}. Nothing merges on its own.
        </div>
      )}
      <div className="row">
        <input className="in" style={{ maxWidth: 320 }} placeholder="Search name, company, email or phone" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search contacts" />
        <button className="btn" onClick={() => setEdit(blank(biz === "all" ? [] : [biz]))}>Add contact</button>
      </div>
      {edit && (
        <div className="card form">
          <h2>{edit.id ? "Edit contact" : "New contact"}</h2>
          <div className="f2">
            <div className="f"><label>Name</label><input className="in" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
            <div className="f"><label>Company</label><input className="in" value={edit.company} onChange={(e) => setEdit({ ...edit, company: e.target.value })} /></div>
            <div className="f"><label>Email</label><input className="in" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></div>
            <div className="f"><label>Phone</label><input className="in" value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></div>
            <div className="f"><label>Source</label><input className="in" placeholder="Referral, event, screenshot" value={edit.source} onChange={(e) => setEdit({ ...edit, source: e.target.value })} /></div>
          </div>
          <div className="row">
            <span className="lbl">Businesses</span>
            {mine.map(([k, n]) => (
              <label className="check" key={k}><input type="checkbox" checked={edit.businesses.includes(k)} onChange={() => toggle(k)} />{n}</label>
            ))}
          </div>
          <div className="f"><label>Notes</label><textarea className="in" rows={2} value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></div>
          {msg && <p className="err">{msg}</p>}
          <div className="row"><button className="btn" onClick={save}>Save</button><button className="btn ghost" onClick={() => setEdit(null)}>Cancel</button></div>
        </div>
      )}
      <div className="card scroll">
        <table className="tbl">
          <thead><tr><th>Name</th><th>Company</th><th>Email</th><th>Phone</th><th>Businesses</th><th></th></tr></thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id}>
                <td>{c.name} {c.sample && <span className="pill hold">Sample</span>}</td>
                <td>{c.company}</td><td>{c.email}</td><td>{c.phone}</td>
                <td>{c.businesses.map(bizName).join(", ")}</td>
                <td><button className="btn ghost" onClick={() => setEdit(c)}>Edit</button></td>
              </tr>
            ))}
            {data && list.length === 0 && <tr><td colSpan={6} className="muted">No contacts yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
