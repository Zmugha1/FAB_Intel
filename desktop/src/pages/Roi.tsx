import { useState } from "react";
import { PageProps } from "../App";
import { RoiRow, call } from "../ipc";
import { today } from "../format";
import { useLoad } from "./useLoad";
import { Tip } from "../Tip";

const show = (v: number | null, unit: string) => {
  if (v === null) return "Not yet";
  if (unit === "dollars" || unit === "dollars/month") return "$" + v.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (unit === "percent") return v + "%";
  return `${v} ${unit}`;
};

export default function Roi({ changed }: PageProps) {
  const { data, error, reload } = useLoad<RoiRow[]>("roi_rows", { today: today() });
  const [values, setValues] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");

  const save = async (row: RoiRow) => {
    const text = values[row.key] ?? "";
    const value = text.trim() === "" ? null : Number(text);
    if (value !== null && Number.isNaN(value)) return setMsg("Enter a number.");
    try {
      await call("baseline_set", { key: row.key, value, note: row.note });
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
        <span className="eyebrow">1.7 ROI</span>
        <h1>Return on investment</h1>
        <p className="sub">Your starting numbers next to what FAB Intel measures from its own records. Sample data is never counted.</p>
      </div>
      {error && <p className="err">{error}</p>}
      {msg && <p className="err">{msg}</p>}
      <div className="card scroll">
        <table className="tbl">
          <thead><tr><th>Measure</th><th>Starting number<Tip text="Your number from before FAB Intel, from your STZ interview or your own records. Leave it missing rather than guess." /></th><th>Now<Tip text="Measured from your FAB Intel records. Shows a dash until there is enough real data. Sample data never counts." /></th><th>How it is measured</th></tr></thead>
          <tbody>
            {data?.map((r) => (
              <tr key={r.key}>
                <td>{r.label}</td>
                <td>
                  <div className="row">
                    <input className="in" style={{ width: 100 }} placeholder={r.baseline === null ? "Missing" : String(r.baseline)} value={values[r.key] ?? ""} onChange={(e) => setValues({ ...values, [r.key]: e.target.value })} aria-label={"Starting number for " + r.label} />
                    <button className="btn ghost" onClick={() => save(r)}>Save</button>
                  </div>
                  <span className="muted">{show(r.baseline, r.unit)}</span>
                </td>
                <td>{show(r.now, r.unit)}</td>
                <td className="muted">{r.how}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
