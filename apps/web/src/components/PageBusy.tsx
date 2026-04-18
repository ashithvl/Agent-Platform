type PageBusyProps = {
  /** Shown next to the spinner (also for screen readers via the status region). */
  message?: string;
  /** Full viewport height for bootstrapping routes; shorter for in-layout waits. */
  layout?: "fullscreen" | "section";
};

/** Accessible loading state: spinner, polite live region, and `aria-busy`. */
export function PageBusy({ message = "Loading…", layout = "fullscreen" }: PageBusyProps) {
  const minH = layout === "fullscreen" ? "min-h-screen" : "min-h-[40vh]";
  return (
    <div
      className={`flex ${minH} flex-col items-center justify-center gap-3 bg-white px-6`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span
        className="h-9 w-9 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900"
        aria-hidden
      />
      <p className="text-sm text-neutral-600">{message}</p>
    </div>
  );
}
