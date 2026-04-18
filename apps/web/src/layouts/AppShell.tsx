import { useMemo, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { NavIcon } from "../components/NavIcons";
import { SkipToMain } from "../components/SkipToMain";
import { useAuth } from "../auth/AuthContext";
import { NAV_GROUPS, NAV_ITEMS, navVisible, type NavGroup, type NavItem } from "../nav/navConfig";

function formatDisplayName(raw: string | undefined): string {
  if (!raw?.trim()) return "User";
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

function initialsFromName(raw: string | undefined): string {
  if (!raw?.trim()) return "?";
  const part = raw.split(/[@\s_]/)[0] ?? raw;
  return part.slice(0, 2).toUpperCase();
}

function roleBadge(roles: Set<string>, username: string | undefined): string {
  if (roles.has("platform-admin") || roles.has("admin")) return "Admin";
  if (username?.toLowerCase() === "developer") return "Developer";
  if (roles.has("builder")) return "Builder";
  return "Member";
}

export default function AppShell() {
  const { user, logout, realmRoles } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const grouped = useMemo(() => {
    const byGroup = new Map<NavGroup, NavItem[]>();
    for (const g of NAV_GROUPS) byGroup.set(g.id, []);
    for (const item of NAV_ITEMS) {
      if (!navVisible(realmRoles, item)) continue;
      byGroup.get(item.group)?.push(item);
    }
    return NAV_GROUPS.map((g) => ({ group: g, items: byGroup.get(g.id) ?? [] })).filter((s) => s.items.length > 0);
  }, [realmRoles]);

  const displayName = formatDisplayName(user?.profile.preferred_username ?? user?.sub);
  const badge = roleBadge(realmRoles, user?.profile.preferred_username ?? user?.sub);

  return (
    <div className="flex min-h-0 w-full flex-1 overflow-hidden bg-neutral-50 text-neutral-900">
      <SkipToMain />

      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-neutral-900/50 backdrop-blur-[1px] lg:hidden"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <aside
        className={[
          "fixed inset-y-0 left-0 z-50 flex w-60 min-h-0 flex-col border-r border-neutral-200 bg-white transition-transform lg:static lg:min-h-screen lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        ].join(" ")}
      >
        {/* Brand */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-200 px-4">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2 text-left"
          >
            <span
              aria-hidden
              className="flex h-7 w-7 items-center justify-center rounded-md bg-neutral-900 text-[11px] font-semibold text-white"
            >
              EA
            </span>
            <span className="text-sm font-semibold tracking-tight text-neutral-900">Enterprise AI</span>
          </button>
          <button
            type="button"
            className="rounded p-1 text-neutral-500 hover:bg-neutral-100 lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Close sidebar"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav
          aria-label="Primary"
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4"
        >
          {grouped.map(({ group, items }, idx) => (
            <div key={group.id} className={idx === 0 ? "" : "mt-5"}>
              <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      onClick={() => setMobileOpen(false)}
                      className={({ isActive }) =>
                        [
                          "group relative flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
                          isActive
                            ? "bg-neutral-900 text-white"
                            : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
                        ].join(" ")
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <span
                            className={[
                              "flex h-4 w-4 items-center justify-center [&>svg]:h-[18px] [&>svg]:w-[18px]",
                              isActive ? "text-white" : "text-neutral-500 group-hover:text-neutral-900",
                            ].join(" ")}
                          >
                            <NavIcon name={item.icon} />
                          </span>
                          <span className="truncate">{item.label}</span>
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="mt-auto shrink-0 border-t border-neutral-200 bg-white p-3">
          <div className="flex items-center gap-2.5 rounded-md px-1.5 py-1.5">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-[11px] font-semibold text-white"
              aria-hidden
            >
              {initialsFromName(user?.profile.preferred_username ?? user?.sub)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-neutral-900">{displayName}</p>
              <p className="truncate text-[11px] text-neutral-500">{badge} · Signed in</p>
            </div>
            <button
              type="button"
              onClick={() => void logout()}
              className="shrink-0 rounded-md border border-neutral-200 px-2 py-1 text-xs font-medium text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-900"
              aria-label="Sign out"
              title="Sign out"
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <button
        type="button"
        className="fixed left-4 top-4 z-30 flex h-10 w-10 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-900 shadow-sm transition hover:bg-neutral-50 lg:hidden"
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <main
          id="main-content"
          className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white pt-14 lg:pt-0"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
