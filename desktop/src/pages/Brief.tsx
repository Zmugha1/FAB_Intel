import { PageProps } from "../App";
import { BriefItem } from "../ipc";
import { bizName, today } from "../format";
import { useLoad } from "./useLoad";

const STRIPE: Record<string, string> = { act: "warn", watch: "hold", gap: "" };
const LABEL: Record<string, string> = { act: "Needs you today", watch: "Follow up", gap: "Setup gap" };

export default function Brief({ user, biz, go }: PageProps) {
  const { data, error } = useLoad<BriefItem[]>("brief_items", { today: today() });
  const items = (data ?? []).filter((i) => biz === "all" || !i.business || i.business === biz);
  const count = (l: string) => items.filter((i) => i.level === l).length;
  return (
    <>
      <div className="hd">
        <span className="eyebrow">1.6 Morning Brief</span>
        <h1>Good morning, {user.name}</h1>
        <p className="sub">Built from your records by code. Nothing here is guessed.</p>
      </div>
      {error && <p className="err">{error}</p>}
      <div className="grid g4">
        <div className="card kpi"><span className="v">{count("act")}</span><span className="l">Need you today</span></div>
        <div className="card kpi"><span className="v">{count("watch")}</span><span className="l">Follow-ups</span></div>
        {user.role === "owner" && <div className="card kpi"><span className="v">{count("gap")}</span><span className="l">Setup gaps</span></div>}
      </div>
      <div className="list">
        {data && items.length === 0 && <p className="muted">Nothing needs you right now.</p>}
        {items.map((i, n) => (
          <div className="item" key={n}>
            <span className={"stripe " + STRIPE[i.level]} />
            <div>
              <div className="t">{i.title}</div>
              <div className="m">{i.detail}</div>
              <div className="m">{LABEL[i.level]}{i.business ? " · " + bizName(i.business) : ""}</div>
            </div>
            <button className="btn ghost" onClick={() => go(i.view)}>Open</button>
          </div>
        ))}
      </div>
    </>
  );
}
