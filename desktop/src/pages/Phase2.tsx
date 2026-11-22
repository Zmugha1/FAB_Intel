import { Module } from "../modules";

export default function Phase2({ module }: { module: Module }) {
  return (
    <>
      <div className="hd">
        <span className="eyebrow">Phase 2 · {module.num}</span>
        <h1>{module.label}</h1>
        <p className="sub">{module.what}</p>
      </div>
      <div className="callout hold">
        Phase 2 is in your agreement and is built after Phase 1 is running. This screen turns on when it is delivered.
      </div>
    </>
  );
}
