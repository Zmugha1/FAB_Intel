import { useCallback, useEffect, useState } from "react";
import { call } from "../ipc";

/** Loads one backend list and reloads it on demand. */
export function useLoad<T>(command: string, args: Record<string, unknown> = {}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const key = JSON.stringify(args);
  const reload = useCallback(() => {
    call<T>(command, JSON.parse(key)).then((d) => { setData(d); setError(""); }).catch((e: Error) => setError(e.message));
  }, [command, key]);
  useEffect(reload, [reload]);
  return { data, error, reload };
}
