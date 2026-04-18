import type { ReactNode } from "react";

import { Breadcrumbs } from "./Breadcrumbs";
import { WORKSPACE_SHELL_CLASS } from "../lib/workspaceLayout";

type PageChromeProps = {
  title: string;
  description?: ReactNode;
  /** Right side of the title row (buttons). */
  actions?: ReactNode;
  children: ReactNode;
  /** Set false when the page supplies its own heading (e.g. Workflows tabs). */
  showTitle?: boolean;
};

export function PageChrome({ title, description, actions, children, showTitle = true }: PageChromeProps) {
  return (
    <div className={WORKSPACE_SHELL_CLASS}>
      <Breadcrumbs />
      {showTitle ? (
        <header className="flex flex-col gap-4 border-b border-neutral-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">{title}</h1>
            {description ? <div className="mt-1 text-sm text-neutral-600">{description}</div> : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </header>
      ) : null}
      {children}
    </div>
  );
}
