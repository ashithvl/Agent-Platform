import { useEffect, useMemo, useRef, useState } from "react";

/** Re-run `listFn` when a `CustomEvent` fires on `window` (localStorage writes). */
export function useSyncedList<T>(eventName: string, listFn: () => T[]): T[] {
  const [tick, setTick] = useState(0);
  const listFnRef = useRef(listFn);
  listFnRef.current = listFn;
  useEffect(() => {
    const onEv = () => setTick((x) => x + 1);
    window.addEventListener(eventName, onEv);
    return () => window.removeEventListener(eventName, onEv);
  }, [eventName]);
  return useMemo(() => listFnRef.current(), [tick, eventName]);
}
