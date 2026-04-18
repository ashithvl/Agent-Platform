import type { ReactNode } from "react";

/** Illustration style for empty panels — keeps pages visually distinct where helpful. */
export type EmptyStateVisual =
  | "default"
  | "chat"
  | "workflow"
  | "pipeline"
  | "chart"
  | "key"
  | "folder"
  | "users"
  | "shield"
  | "activity";

type EmptyStateProps = {
  title: string;
  description: ReactNode;
  action?: ReactNode;
  visual?: EmptyStateVisual;
  /** Tighter padding for nested areas (e.g. sidebars, fieldsets). */
  compact?: boolean;
  className?: string;
};

function EmptyStateIcon({ visual }: { visual: EmptyStateVisual }) {
  const stroke = "currentColor";
  const common = "h-6 w-6 text-neutral-500";
  switch (visual) {
    case "chat":
      return (
        <svg className={common} fill="none" stroke={stroke} viewBox="0 0 24 24" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
      );
    case "workflow":
      return (
        <svg className={common} fill="none" stroke={stroke} viewBox="0 0 24 24" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM9 12h6M12 9v6M4 19a1 1 0 011-1h4a1 1 0 011 1v0a1 1 0 01-1 1H5a1 1 0 01-1-1v0z"
          />
        </svg>
      );
    case "pipeline":
      return (
        <svg className={common} fill="none" stroke={stroke} viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h10M4 18h14" />
        </svg>
      );
    case "chart":
      return (
        <svg className={common} fill="none" stroke={stroke} viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 19V5M9 19V9M14 19v-6M19 19V8" />
        </svg>
      );
    case "key":
      return (
        <svg className={common} fill="none" stroke={stroke} viewBox="0 0 24 24" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M15 7a2 2 0 012 2m4 0a6 6 0 11-11 0 6 6 0 0111 0zm-7 0h4m-4 3h2m-2 3h1"
          />
        </svg>
      );
    case "folder":
      return (
        <svg className={common} fill="none" stroke={stroke} viewBox="0 0 24 24" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
          />
        </svg>
      );
    case "users":
      return (
        <svg className={common} fill="none" stroke={stroke} viewBox="0 0 24 24" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      );
    case "shield":
      return (
        <svg className={common} fill="none" stroke={stroke} viewBox="0 0 24 24" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          />
        </svg>
      );
    case "activity":
      return (
        <svg className={common} fill="none" stroke={stroke} viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
    default:
      return (
        <svg className={common} fill="none" stroke={stroke} viewBox="0 0 24 24" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 6h16M4 10h16M4 14h10M4 18h8"
          />
        </svg>
      );
  }
}

/**
 * Standalone empty panel — use for lists, cards, sidebars, and non-table layouts.
 * Table rows should use `EmptyTablePlaceholder`, which composes this component.
 */
export function EmptyState({
  title,
  description,
  action,
  visual = "default",
  compact,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={[
        "mx-auto flex max-w-md flex-col items-center text-center",
        compact ? "py-4" : "py-10",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        className="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-neutral-300 bg-neutral-50 text-neutral-400"
        aria-hidden
      >
        <EmptyStateIcon visual={visual} />
      </div>
      <p className="mt-4 text-sm font-semibold text-neutral-900">{title}</p>
      <div className="mt-1 text-sm leading-relaxed text-neutral-600">{description}</div>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
