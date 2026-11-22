import { useState } from "react";
import { call, Status } from "../ipc";

export default function SignIn({ status, done }: { status: Status; done: () => void }) {
  const [name, setName] = useState("");
  const [userId, setUserId] = useState(status.users[0]?.id ?? "");
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (status.needs_setup && password !== again) return setError("The two passwords do not match.");
    setBusy(true);
    try {
      if (status.needs_setup) await call("setup_owner", { name, password });
      else await call("sign_in", { userId, password });
      done();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
      setPassword("");
      setAgain("");
    }
  };

  return (
    <div className="signin">
      <form className="card form" onSubmit={submit}>
        <div className="hd">
          <span className="eyebrow">FAB Intel</span>
          <h1>{status.needs_setup ? "Set up the owner" : "Sign in"}</h1>
          <p className="sub">
            {status.needs_setup
              ? "First run on this computer. The owner sets the rules and adds staff."
              : "Your data stays on this computer."}
          </p>
        </div>
        {status.needs_setup ? (
          <div className="f"><label htmlFor="n">Your name</label><input id="n" className="in" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></div>
        ) : (
          <div className="f">
            <label htmlFor="u">Who is signing in</label>
            <select id="u" className="in" value={userId} onChange={(e) => setUserId(e.target.value)}>
              {status.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        )}
        <div className="f"><label htmlFor="p">Password</label><input id="p" type="password" className="in" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus={!status.needs_setup} /></div>
        {status.needs_setup && (
          <div className="f"><label htmlFor="p2">Password again</label><input id="p2" type="password" className="in" value={again} onChange={(e) => setAgain(e.target.value)} /></div>
        )}
        {status.needs_setup && <p className="muted">At least 10 characters.</p>}
        {error && <p className="err" role="alert">{error}</p>}
        <button className="btn" disabled={busy || !password}>{status.needs_setup ? "Create owner" : "Sign in"}</button>
        <p className="muted">FAB Intel v{status.version} · Built by Dr. Data Decision Intelligence</p>
      </form>
    </div>
  );
}
