import { useState } from "react";
import { PageProps } from "../App";
import { call, Contact, Project } from "../ipc";
import { BUSINESSES, bizName } from "../format";
import { useLoad } from "./useLoad";
import { Tip } from "../Tip";

const COLUMNS: [string, string][] = [["none", "Art and setup"], ["sent", "Proof sent"], ["revise", "Changes asked"], ["approved", "Approved"]];

export default function Projects({ user, biz, changed }: PageProps) {
  const { data, error, reload } = useLoad<Project[]>("projects_list");
  const contacts = useLoad<Contact[]>("contacts_list");
  const [edit, setEdit] = useState<Project | null>(null);
  const [msg, setMsg] = useState("");
  const mine = BUSINESSES.filter(([k]) => user.businesses.includes(k));
  const list = (data ?? []).filter((p) => (biz === "all" || p.business === biz) && p.status === "open");

  const save = async (p: Project) => {
    try {
      await call("project_save", { project: p });
      setEdit(null);
      setMsg("");
      reload();
      changed();
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  return (
    <>
      <div className="hd">
        <span className="eyebrow">1.5 Projects and artwork</span>
        <h1>Projects</h1>
        <p className="sub">Proofs and revisions in one place. Art is linked, not copied. A person checks the art before the proof goes out.</p>
      </div>
      {error && <p className="err">{error}</p>}
      <div className="row"><button className="btn" disabled={!contacts.data?.length} onClick={() => setEdit({ id: 0, name: "", contact_id: 0, contact: "", quote_id: null, business: biz !== "all" ? biz : mine[0][0], art_link: "", art_ok: false, proof: "none", revisions: 0, in_hands: "", status: "open", notes: "", sample: false })}>New project</button></div>
      {msg && <p className="err" role="alert">{msg}</p>}
      {edit && (
        <div className="card form">
          <h2>{edit.id ? edit.name : "New project"}</h2>
          <div className="f2">
            <div className="f"><label>Name</label><input className="in" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
            <div className="f"><label>Contact</label>
              <select className="in" value={edit.contact_id} onChange={(e) => setEdit({ ...edit, contact_id: Number(e.target.value) })}>
                <option value={0}>Pick a contact</option>
                {contacts.data?.map((c) => <option key={c.id} value={c.id}>{c.name}{c.company ? ", " + c.company : ""}</option>)}
              </select>
            </div>
            <div className="f"><label>Business</label><select className="in" value={edit.business} onChange={(e) => setEdit({ ...edit, business: e.target.value })}>{mine.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></div>
            <div className="f"><label>In-hands date<Tip text="The day the customer must have the order. The Morning Brief flags it once it is 7 days away and the proof is not approved." /></label><input type="date" className="in" value={edit.in_hands} onChange={(e) => setEdit({ ...edit, in_hands: e.target.value })} /></div>
            <div className="f"><label>Art link (Google Drive, Dropbox)<Tip text="Paste a share link. FAB Intel keeps the link only. The art file stays where it is." /></label><input className="in" value={edit.art_link} onChange={(e) => setEdit({ ...edit, art_link: e.target.value })} /></div>
            <div className="f"><label>Proof<Tip text="Where the proof stands. Moving a project to Changes asked adds one to its revision count." /></label><select className="in" value={edit.proof} onChange={(e) => setEdit({ ...edit, proof: e.target.value })}>{COLUMNS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></div>
            <div className="f"><label>Status</label><select className="in" value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}><option value="open">Open</option><option value="delivered">Delivered</option><option value="closed">Closed</option></select></div>
          </div>
          <label className="check"><input type="checkbox" checked={edit.art_ok} onChange={(e) => setEdit({ ...edit, art_ok: e.target.checked })} />Art checked: sharp enough to print, right colors</label>
          <div className="f"><label>Notes</label><textarea className="in" rows={2} value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></div>
          <div className="row"><button className="btn" onClick={() => save(edit)}>Save</button><button className="btn ghost" onClick={() => setEdit(null)}>Cancel</button></div>
        </div>
      )}
      <div className="grid g4">
        {COLUMNS.map(([k, label]) => (
          <div className="card" key={k}>
            <h2>{label}</h2>
            {list.filter((p) => p.proof === k).map((p) => (
              <button key={p.id} className="item" style={{ textAlign: "left", cursor: "pointer", gridTemplateColumns: "1fr" }} onClick={() => setEdit(p)}>
                <div>
                  <div className="t">{p.name} {p.sample && <span className="pill hold">Sample</span>}</div>
                  <div className="m">{p.contact} · {bizName(p.business)}</div>
                  <div className="m">{p.in_hands ? "In hands " + p.in_hands : "No in-hands date"}{p.revisions > 0 ? ` · ${p.revisions} revision${p.revisions > 1 ? "s" : ""}` : ""}{!p.art_ok ? " · art not checked" : ""}</div>
                </div>
              </button>
            ))}
            {data && list.filter((p) => p.proof === k).length === 0 && <p className="muted">None</p>}
          </div>
        ))}
      </div>
    </>
  );
}
