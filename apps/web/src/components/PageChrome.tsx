import type { ReactNode } from "react";

import { WORKSPACE_SHELL_CLASS } from "../lib/workspaceLayout";

type PageChromeProps = {
  title: string;
  description?: ReactNode;
  /** Right side of the title row (buttons). */
  actions?: ReactNode;
  children: ReactNode;
  /** Set false when the page supplies its own heading (e.g. workflow editor). */
  showTitle?: boolean;
};

export function PageChrome({ title, description, actions, children, showTitle = true }: PageChromeProps) {
  return (
    <div
      className={[
        WORKSPACE_SHELL_CLASS,
        "flex min-h-0 flex-1 flex-col overflow-hidden pb-0",
        showTitle ? "pt-3" : "pt-0",
      ].join(" ")}
    >
      {showTitle ? (
        <header className="sr-only">
          <h1>{title}</h1>
          {description ? <div>{description}</div> : null}
        </header>
      ) : null}

      {actions ? (
        <div className="shrink-0 border-b border-neutral-200 pb-3">
          <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain pt-4 pb-10">
        {children}
      </div>
    </div>
  );
}
