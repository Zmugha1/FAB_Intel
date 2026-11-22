import { useCallback, useEffect, useState } from "react";
import { call, Status, User } from "./ipc";
import { BUSINESSES } from "./format";
import { MODULES } from "./modules";
import { VERSION } from "./version";
import SignIn from "./pages/SignIn";
import Brief from "./pages/Brief";
import Contacts from "./pages/Contacts";
import Quotes from "./pages/Quotes";
import Invoices from "./pages/Invoices";
import Projects from "./pages/Projects";
import Roi from "./pages/Roi";
import RulesPage from "./pages/Rules";
import Phase2 from "./pages/Phase2";

export type PageProps = { user: User; biz: string; go: (view: string) => void; changed: () => void };

export default function App() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState("");
  const [view, setView] = useState("brief");
  const [biz, setBiz] = useState("all");
  const [tick, setTick] = useState(0);

  const load = useCallback(() => {
    call<Status>("status").then(setStatus).catch((e: Error) => setError(e.message));
  }, []);
  useEffect(load, [load, tick]);
  useEffect(() => {
    window.addEventListener("fab-signed-out", load);
    return () => window.removeEventListener("fab-signed-out", load);
  }, [load]);

  if (error) return <div className="signin"><div className="card"><p className="err">{error}</p></div></div>;
  if (!status) return <div className="signin"><p className="muted">Opening FAB Intel</p></div>;
  if (!status.user) return <SignIn status={status} done={load} />;

  const user = status.user;
  const changed = () => setTick((t) => t + 1);
  const mine = BUSINESSES.filter(([k]) => user.businesses.includes(k));
  const mod = MODULES.find((m) => m.key === view);
  const props: PageProps = { user, biz, go: setView, changed };

  let page;
  if (mod?.phase === 2) page = <Phase2 module={mod} />;
  else if (mod?.owner && user.role !== "owner") page = <p className="muted">This page is for the owner.</p>;
  else if (view === "brief") page = <Brief {...props} />;
  else if (view === "contacts") page = <Contacts {...props} />;
  else if (view === "quotes") page = <Quotes {...props} />;
  else if (view === "invoices") page = <Invoices {...props} />;
  else if (view === "projects") page = <Projects {...props} />;
  else if (view === "roi") page = <Roi {...props} />;
  else page = <RulesPage {...props} status={status} />;

  const signOut = () => call("sign_out").then(load);

  return (
    <div className="app">
      <nav className="rail" aria-label="Modules">
        <div className="brand"><div><b>FAB Intel</b><small>Private. Governed. Yours.</small></div></div>
        {[1, 2].map((phase) => (
          <div className="navgrp" key={phase}>
            <div className="navlbl">{phase === 1 ? "Phase 1. Run the Business" : "Phase 2. Grow the Business"}</div>
            {MODULES.filter((m) => m.phase === phase && (!m.owner || user.role === "owner")).map((m) => (
              <button
                key={m.key}
                className={"nav" + (m.phase === 2 ? " locked" : "")}
                aria-current={view === m.key ? "page" : undefined}
                onClick={() => setView(m.key)}
                title={m.phase === 2 ? "Phase 2. Not yet delivered." : m.what}
              >
                <span>{m.label}</span>
                <span className="n">{m.phase === 2 ? <span className="ph">Phase 2</span> : m.num}</span>
              </button>
            ))}
          </div>
        ))}
        <div className="railfoot">
          <span>Data first. Decisions second. AI third.</span>
        </div>
      </nav>
      <div className="main">
        {status.sample && (
          <div className="banner" role="status">
            <span>Sample data. Every name and figure marked sample is fictional.</span>
            {user.role === "owner" && <button className="btn ghost" onClick={() => call("sample_clear").then(changed).catch((e: Error) => alert(e.message))}>Remove sample data</button>}
          </div>
        )}
        <header className="top">
          <div className="ctl">
            <label htmlFor="biz">Business</label>
            <div className="seg" id="biz">
              {mine.length > 1 && <button aria-pressed={biz === "all"} onClick={() => setBiz("all")}>All</button>}
              {mine.map(([k, name]) => (
                <button key={k} aria-pressed={biz === k || mine.length === 1} onClick={() => setBiz(k)}>{name}</button>
              ))}
            </div>
          </div>
          <div className="ctl">
            <span>Signed in as <b>{user.name}</b> ({user.role === "owner" ? "owner" : "staff"})</span>
            <button className="btn ghost" onClick={signOut}>Sign out</button>
          </div>
        </header>
        <main className="pane">{page}</main>
        <footer className="footer">
          <span>FAB Intel v{VERSION} · build {status.commit}</span>
          <span>Built by Dr. Data Decision Intelligence</span>
        </footer>
      </div>
    </div>
  );
}
