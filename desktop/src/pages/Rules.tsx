import { useState } from "react";
import { PageProps } from "../App";
import { LogRow, Rules, Status, User, call } from "../ipc";
import { BUSINESSES, bizName, money, pct, today } from "../format";
import { SYSTEMS } from "../modules";
import { useLoad } from "./useLoad";

const FIELDS: { key: keyof Rules; label: string; kind: "pct" | "money" | "days" | "yesno" }[] = [
  { key: "margin_floor_bp", label: "Margin floor", kind: "pct" },
  { key: "approve_over_cents", label: "Owner approves quotes over", kind: "money" },
  { key: "staff_quotes_need_owner", label: "Owner approves every staff quote", kind: "yesno" },
  { key: "tax_rate_bp", label: "Sales tax rate", kind: "pct" },
  { key: "quote_valid_days", label: "Quote holds for", kind: "days" },
  { key: "follow_up_days", label: "Follow up on a sent quote after", kind: "days" },
];

function shown(r: Rules, f: (typeof FIELDS)[number]) {
  const v = r[f.key];
  if (f.kind === "pct") return pct(v as number | null);
  if (f.kind === "money") return money(v as number);
  if (f.kind === "yesno") return v ? "Yes" : "No";
  return `${v} days`;
}

/** Turns what the owner types into the stored value: percent to basis points, dollars to cents. */
function stored(kind: string, text: string): string | null {
  const t = text.trim().replace(/[$,%\s]/g, "");
  if (kind === "yesno") return /^y/i.test(text.trim()) ? "1" : /^n/i.test(text.trim()) ? "0" : null;
  const n = Number(t);
  if (t === "" || Number.isNaN(n) || n < 0) return null;
  if (kind === "pct") return String(Math.round(n * 100));
  if (kind === "money") return String(Math.round(n * 100));
  return Number.isInteger(n) ? String(n) : null;
}

export default function RulesPage({ user, changed, status }: PageProps & { status: Status }) {
  const owner = user.role === "owner";
  const rules = useLoad<Rules>("rules_get");
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState("");

  const run = async (fn: () => Promise<unknown>, done: string) => {
    setMsg("");
    setOk("");
    try {
      await fn();
      setOk(done);
      changed();
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  const saveRule = (f: (typeof FIELDS)[number]) => {
    const value = stored(f.kind, edits[f.key] ?? "");
    if (value === null) return setMsg(f.kind === "yesno" ? "Type yes or no." : "Enter a number.");
    run(() => call("rule_set", { key: f.key, value }).then(rules.reload), "Rule saved.");
  };

  return (
    <>
      <div className="hd">
        <span className="eyebrow">1.1 Platform</span>
        <h1>Rules and users</h1>
        <p className="sub">Your rules run the quotes and the Morning Brief. Every change is written to the decision log.</p>
      </div>
      {msg && <p className="err" role="alert">{msg}</p>}
      {ok && <p className="okmsg">{ok}</p>}

      <div className="card">
        <h2>Your rules</h2>
        <table className="tbl">
          <tbody>
            {rules.data && FIELDS.map((f) => (
              <tr key={f.key}>
                <td>{f.label}</td>
                <td>{shown(rules.data!, f)}</td>
                {owner && (
                  <td>
                    <div className="row">
                      <input className="in" style={{ width: 120 }} placeholder={f.kind === "pct" ? "e.g. 5.5" : f.kind === "money" ? "e.g. 2500" : f.kind === "yesno" ? "yes or no" : "days"} value={edits[f.key] ?? ""} onChange={(e) => setEdits({ ...edits, [f.key]: e.target.value })} aria-label={f.label} />
                      <button className="btn ghost" onClick={() => saveRule(f)}>Save</button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted">Starting rules come from your signed agreement and your STZ interview. Change them here when they change.</p>
      </div>

      {owner && <Users me={user} run={run} />}

      <div className="card">
        <h2>Your systems</h2>
        <p className="muted">Each connection is Planned until it is built and tested with your accounts.</p>
        <table className="tbl">
          <thead><tr><th>System</th><th>What it does for you</th><th>When</th><th>Status</th></tr></thead>
          <tbody>
            {SYSTEMS.map((s) => (
              <tr key={s.name}><td>{s.name}</td><td>{s.use}</td><td>{s.phase}</td><td><span className="pill mute">Planned</span></td></tr>
            ))}
          </tbody>
        </table>
      </div>

      {owner && (
        <div className="card">
          <h2>Sample data</h2>
          <p className="muted">For showing FAB Intel without your real records. Every sample row is marked, and one click removes all of it.</p>
          <div className="row">
            {!status.sample && <button className="btn ghost" onClick={() => run(() => call("sample_load", { today: today() }), "Sample data loaded.")}>Load sample data</button>}
            {status.sample && <button className="btn ghost" onClick={() => run(() => call("sample_clear"), "Sample data removed.")}>Remove sample data</button>}
          </div>
        </div>
      )}

      {owner && <Log />}
    </>
  );
}

function Users({ me, run }: { me: User; run: (fn: () => Promise<unknown>, done: string) => void }) {
  const users = useLoad<User[]>("users_list");
  const [form, setForm] = useState({ name: "", role: "staff", businesses: ["FB"], password: "" });
  const [reset, setReset] = useState<Record<string, string>>({});
  const toggle = (k: string) => setForm({ ...form, businesses: form.businesses.includes(k) ? form.businesses.filter((b) => b !== k) : [...form.businesses, k] });

  return (
    <div className="card">
      <h2>Users</h2>
      <p className="muted">Each person has their own sign-in. Staff see only the businesses ticked for them. There is no per-person fee.</p>
      <table className="tbl">
        <thead><tr><th>Name</th><th>Role</th><th>Businesses</th><th>Password</th><th></th></tr></thead>
        <tbody>
          {users.data?.map((u) => (
            <tr key={u.id}>
              <td>{u.name}{!u.active && <> <span className="pill mute">Off</span></>}</td>
              <td>{u.role}</td>
              <td>{u.businesses.map(bizName).join(", ")}</td>
              <td>
                <div className="row">
                  <input type="password" className="in" style={{ width: 150 }} placeholder="New password" value={reset[u.id] ?? ""} onChange={(e) => setReset({ ...reset, [u.id]: e.target.value })} aria-label={"New password for " + u.name} />
                  <button className="btn ghost" onClick={() => run(() => call("user_set_password", { id: u.id, password: reset[u.id] ?? "" }).then(() => setReset({ ...reset, [u.id]: "" })), "Password set.")}>Set</button>
                </div>
              </td>
              <td>{u.id !== me.id && <button className="btn ghost" onClick={() => run(() => call("user_set_active", { id: u.id, active: !u.active }).then(users.reload), u.active ? "User turned off." : "User turned on.")}>{u.active ? "Turn off" : "Turn on"}</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="form">
        <div className="f2">
          <div className="f"><label>Name</label><input className="in" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="f"><label>Role</label><select className="in" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="staff">Staff</option><option value="owner">Owner</option></select></div>
          <div className="f"><label>First password</label><input type="password" className="in" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
        </div>
        <div className="row">{BUSINESSES.map(([k, n]) => <label className="check" key={k}><input type="checkbox" checked={form.businesses.includes(k)} onChange={() => toggle(k)} />{n}</label>)}</div>
        <div className="row"><button className="btn" onClick={() => run(() => call("user_add", form).then(() => { setForm({ name: "", role: "staff", businesses: ["FB"], password: "" }); users.reload(); }), "User added.")}>Add user</button></div>
      </div>
    </div>
  );
}

function Log() {
  const { data } = useLoad<LogRow[]>("log_list");
  return (
    <div className="card scroll">
      <h2>Decision log</h2>
      <table className="tbl">
        <thead><tr><th>When</th><th>Who</th><th>What</th><th>Detail</th></tr></thead>
        <tbody>
          {data?.map((l, i) => (
            <tr key={i}><td>{new Date(l.at * 1000).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td><td>{l.user}</td><td>{l.action} {l.entity}{l.entity_id ? ` #${l.entity_id}` : ""}</td><td>{l.detail}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
