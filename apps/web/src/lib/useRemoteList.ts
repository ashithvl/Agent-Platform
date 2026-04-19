import { useCallback, useEffect, useRef, useState } from "react";

/** Refetch when `eventName` is dispatched on `window` (after mutations). */
export function useRemoteList<T>(eventName: string, fetchList: () => Promise<T[]>): T[] {
  const [rows, setRows] = useState<T[]>([]);
  const fetchRef = useRef(fetchList);
  fetchRef.current = fetchList;

  const reload = useCallback(async () => {
    try {
      setRows(await fetchRef.current());
    } catch {
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload, eventName]);

  useEffect(() => {
    const h = () => void reload();
    window.addEventListener(eventName, h);
    return () => window.removeEventListener(eventName, h);
  }, [eventName, reload]);

  return rows;
}
