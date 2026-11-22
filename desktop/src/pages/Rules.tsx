import { useState } from "react";
import { PageProps } from "../App";
import { LogRow, Rules, Status, User, call } from "../ipc";
import { BUSINESSES, bizName, money, pct, today } from "../format";
import { SYSTEMS } from "../modules";
import { useLoad } from "./useLoad";
import { Tip } from "../Tip";

const FIELDS: { key: keyof Rules; label: string; kind: "pct" | "money" | "days" | "yesno"; tip: string }[] = [
  { key: "margin_floor_bp", label: "Margin floor", kind: "pct", tip: "The lowest margin a quote can have without your approval. Margin is price minus vendor cost, divided by price. A quote under this goes to you before it can be sent." },
  { key: "approve_over_cents", label: "Owner approves quotes over", kind: "money", tip: "Any quote whose total, tax included, is over this amount goes to you before it can be sent, even when you drafted it." },
  { key: "staff_quotes_need_owner", label: "Owner approves every staff quote", kind: "yesno", tip: "Yes means every quote staff draft waits for you, whatever the margin or total. From your STZ interview." },
  { key: "tax_rate_bp", label: "Sales tax rate", kind: "pct", tip: "Added to every quote line that has Tax ticked. Empty means you have not answered yet, and quotes show tax as Not set. Zero means you do not charge sales tax." },
  { key: "staff_see_costs", label: "Staff see vendor costs and margins", kind: "yesno", tip: "No means staff enter prices only and never see your costs or margins. You check costs when their quotes come to you." },
  { key: "quote_valid_days", label: "Quote holds for", kind: "days", tip: "How many days a sent quote stays good. The Morning Brief says when one is about to expire." },
  { key: "follow_up_days", label: "Follow up on a sent quote after", kind: "days", tip: "Days after sending before a quote shows up in the Morning Brief as a follow-up." },
];

function shown(r: Rules, f: (typeof FIELDS)[number]) {
  const v = r[f.key];
  if (v === null) return f.key === "staff_see_costs" ? "Not answered (staff see them for now)" : "Not answered";
  if (f.kind === "pct") return pct(v as number);
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
      window.setTimeout(() => setOk((now) => (now === done ? "" : now)), 3000);
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
      {ok && <p className="okmsg toast" role="status">{ok}</p>}

      {owner && rules.data && <Questions rules={rules.data} save={(key, value, done) => run(() => call("rule_set", { key, value }).then(rules.reload), done)} onError={setMsg} />}

      <div className="card">
        <h2>Your rules</h2>
        <table className="tbl">
          <tbody>
            {rules.data && FIELDS.map((f) => (
              <tr key={f.key}>
                <td>{f.label}<Tip text={f.tip} /></td>
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
        <h2>Your systems<Tip text="Planned means the connection is in your agreement but not built yet. Until then you enter or import these records by hand. Nothing is sent to these systems." /></h2>
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
          <h2>Sample data<Tip text="Made-up businesses and figures for demos. They never count toward ROI, and Remove deletes only rows marked sample. Your own records are not touched." /></h2>
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
      <h2>Users<Tip text="Owner sees all three businesses, the ROI page, the rules and the decision log. Staff see only the businesses ticked for them. Passwords need at least 10 characters. Five wrong tries lock a sign-in for 5 minutes." /></h2>
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
      <h2>Decision log<Tip text="Every change in FAB Intel: who did it, when, and what. It cannot be edited from the app." /></h2>
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

/** Owner answers that change how quotes behave. Each answer goes to the decision log and can be changed later. */
function Questions({ rules, save, onError }: { rules: Rules; save: (key: string, value: string, done: string) => void; onError: (m: string) => void }) {
  const [rate, setRate] = useState("");
  const open = (rules.tax_rate_bp === null ? 1 : 0) + (rules.staff_see_costs === null ? 1 : 0);
  const saveRate = () => {
    const value = stored("pct", rate);
    if (value === null) return onError("Enter the rate as a number, for example 5.5.");
    save("tax_rate_bp", value, "Sales tax rate saved.");
    setRate("");
  };
  const answered = (yes: boolean) => <span className={"pill " + (yes ? "ok" : "hold")}>{yes ? "Answered" : "Not answered"}</span>;

  return (
    <div className="card qcard">
      <h2>Questions for you</h2>
      <p className="muted">{open === 0 ? "All answered. Change an answer here any time." : `${open} ${open === 1 ? "question needs" : "questions need"} your answer before FAB Intel can price quotes the way you work.`}</p>

      <div className="q">
        <h3>1. What sales tax rate do you charge?{answered(rules.tax_rate_bp !== null)}<Tip text="Use your combined rate, state plus county, for where orders are delivered or picked up. Your accountant or the Wisconsin Department of Revenue can confirm it. On each quote you can untick Tax for a line that is not taxable." /></h3>
        <p className="muted">{rules.tax_rate_bp === null ? "Not answered. Quotes show sales tax as Not set." : rules.tax_rate_bp === 0 ? "You do not charge sales tax. Quotes add no tax." : `Now ${pct(rules.tax_rate_bp)} on lines marked taxable.`}</p>
        <div className="row">
          <input className="in" style={{ width: 110 }} placeholder="e.g. 5.5" value={rate} onChange={(e) => setRate(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveRate()} aria-label="Sales tax rate in percent" />
          <span className="muted">%</span>
          <button className="btn" onClick={saveRate}>Save rate</button>
          <button className="btn ghost" onClick={() => save("tax_rate_bp", "0", "Saved: no sales tax.")}>I do not charge sales tax</button>
        </div>
      </div>

      <div className="q">
        <h3>2. Should staff see vendor costs and margins?{answered(rules.staff_see_costs !== null)}<Tip text="Your STZ interview said staff price from vendor costs, so FAB Intel shows costs to staff until you answer. Either way, every staff quote still comes to you for approval." /></h3>
        <label className="choice">
          <input type="radio" name="staff_see_costs" checked={rules.staff_see_costs === true} onChange={() => save("staff_see_costs", "1", "Saved: staff see costs and margins.")} />
          <span><b>Yes.</b> Staff type vendor costs and see the margin as they price. Quotes under your floor are flagged to them and to you.</span>
        </label>
        <label className="choice">
          <input type="radio" name="staff_see_costs" checked={rules.staff_see_costs === false} onChange={() => save("staff_see_costs", "0", "Saved: costs and margins hidden from staff.")} />
          <span><b>No.</b> Staff enter prices only. Costs and margins are hidden from them. When their quote comes to you, you add or check the costs before approving.</span>
        </label>
        {rules.staff_see_costs === null && <p className="muted">Not answered. Staff see costs and margins for now.</p>}
      </div>
    </div>
  );
}
