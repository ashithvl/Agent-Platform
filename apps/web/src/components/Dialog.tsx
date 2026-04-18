import { type ReactNode, useEffect, useId, useRef } from "react";

const sizeClass: Record<"md" | "lg" | "xl", string> = {
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

type DialogProps = {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  size?: keyof typeof sizeClass;
};

/** Modal overlay; closes on Escape and backdrop click. */
export function Dialog({ open, title, description, onClose, children, size = "lg" }: DialogProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      const root = panelRef.current;
      if (!root) return;
      const focusable = root.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      focusable?.focus();
    }, 0);
    return () => window.clearTimeout(t);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[240] flex items-end justify-center sm:items-center" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={[
          "relative z-[241] mb-0 flex max-h-[min(92vh,880px)] w-full flex-col rounded-t-xl border border-neutral-200 bg-white shadow-xl sm:mb-0 sm:rounded-xl",
          sizeClass[size],
        ].join(" ")}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-neutral-200 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold text-neutral-900">
              {title}
            </h2>
            {description ? <p className="mt-1 text-sm text-neutral-600">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md p-2 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">{children}</div>
      </div>
    </div>
  );
}
