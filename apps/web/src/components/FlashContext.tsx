import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type Variant = "success" | "error";

export type FlashContextValue = {
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
};

const FlashContext = createContext<FlashContextValue | undefined>(undefined);

const DISMISS_MS = 4500;

export function FlashProvider({ children }: { children: ReactNode }) {
  const [flash, setFlash] = useState<{ message: string; variant: Variant } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleClear = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setFlash(null);
      timerRef.current = null;
    }, DISMISS_MS);
  }, []);

  const show = useCallback(
    (message: string, variant: Variant) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setFlash({ message, variant });
      scheduleClear();
    },
    [scheduleClear],
  );

  const showSuccess = useCallback((message: string) => show(message, "success"), [show]);
  const showError = useCallback((message: string) => show(message, "error"), [show]);

  const value = useMemo(() => ({ showSuccess, showError }), [showSuccess, showError]);

  return (
    <FlashContext.Provider value={value}>
      {children}
      {flash ? (
        <div
          className={[
            "fixed bottom-6 left-1/2 z-[100] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-lg border px-4 py-3 text-sm shadow-lg",
            flash.variant === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-950"
              : "border-red-200 bg-red-50 text-red-950",
          ].join(" ")}
          role={flash.variant === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          {flash.message}
        </div>
      ) : null}
    </FlashContext.Provider>
  );
}

export function useFlash(): FlashContextValue {
  const v = useContext(FlashContext);
  if (!v) throw new Error("useFlash must be used within FlashProvider");
  return v;
}
