import { Link, useLocation } from "react-router-dom";

import { NAV_ITEMS } from "../nav/navConfig";

const EXTRA_LABELS: Record<string, string> = {
  "/": "Home",
  "/login": "Sign in",
  "/ingestion": "Data ingestion",
};

function labelForPath(pathname: string): string {
  const hit = NAV_ITEMS.find((i) => i.to === pathname);
  if (hit) return hit.label;
  return EXTRA_LABELS[pathname] ?? (pathname.replace(/^\//, "").replace(/-/g, " ") || "Workspace");
}

/**
 * Primary + current page. Keeps wayfinding consistent across workspace routes.
 */
export function Breadcrumbs() {
  const { pathname } = useLocation();
  const current = labelForPath(pathname);

  return (
    <nav aria-label="Breadcrumb" className="mb-6">
      <ol className="flex flex-wrap items-center gap-2 text-sm text-neutral-600">
        <li>
          <Link to="/dashboard" className="font-medium text-neutral-700 underline-offset-4 hover:text-neutral-900 hover:underline">
            Workspace
          </Link>
        </li>
        <li aria-hidden className="text-neutral-400">
          /
        </li>
        <li className="font-medium text-neutral-900" aria-current="page">
          {current}
        </li>
      </ol>
    </nav>
  );
}
