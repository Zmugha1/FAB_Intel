import { useRef, useState } from "react";

/**
 * A small "?" that explains a field. Opens on hover, on keyboard focus, and on click (touch screens).
 * The text is placed with fixed positioning so it is never cut off by a scrolling table.
 */
export function Tip({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const show = () => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const width = 280;
    const left = Math.max(8, Math.min(r.left + r.width / 2 - width / 2, window.innerWidth - width - 8));
    const below = r.bottom + 8;
    setAt({ top: below + 120 > window.innerHeight ? Math.max(8, r.top - 8 - 120) : below, left });
  };
  const hide = () => setAt(null);
  return (
    <span
      ref={ref}
      className="tip"
      tabIndex={0}
      role="button"
      aria-label={text}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onClick={(e) => { e.stopPropagation(); at ? hide() : show(); }}
      onKeyDown={(e) => e.key === "Escape" && hide()}
    >
      ?
      {at && <span className="tiptext" role="tooltip" style={{ top: at.top, left: at.left }}>{text}</span>}
    </span>
  );
}
