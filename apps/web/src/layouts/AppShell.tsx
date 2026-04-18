import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { NavIcon } from "../components/NavIcons";
import { SkipToMain } from "../components/SkipToMain";
import { useAuth } from "../auth/AuthContext";
import { NAV_ITEMS, navVisible } from "../nav/navConfig";

export default function AppShell() {
  const { user, logout, realmRoles } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const items = NAV_ITEMS.filter((i) => navVisible(realmRoles, i));

  return (
    <div className="flex min-h-screen bg-white text-neutral-900">
      <SkipToMain />
      {/* Mobile overlay */}
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      {/* Sidebar */}
      <aside
        className={[
          "fixed inset-y-0 left-0 z-50 flex w-64 min-h-0 flex-col border-r border-neutral-200 bg-neutral-50 transition-transform lg:static lg:min-h-screen lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        ].join(" ")}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-200 px-4">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="text-left font-semibold tracking-tight text-neutral-900"
          >
            Enterprise AI
          </button>
          <button
            type="button"
            className="rounded p-1 text-neutral-600 hover:bg-neutral-200/80 lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Close sidebar"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain px-2 py-4">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                [
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive ? "bg-neutral-900 text-white" : "text-neutral-700 hover:bg-neutral-200/60",
                ].join(" ")
              }
            >
              <NavIcon name={item.icon} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto shrink-0 border-t border-neutral-200 bg-neutral-50 p-3">
          <div className="truncate px-2 text-xs text-neutral-500">
            {user?.profile.preferred_username ?? user?.sub}
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className="mt-2 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-left text-sm font-medium text-neutral-800 hover:bg-neutral-100"
          >
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col lg:pl-0">
        <header className="flex h-14 items-center gap-3 border-b border-neutral-200 bg-white px-4 lg:hidden">
          <button
            type="button"
            className="rounded-md p-2 text-neutral-800 hover:bg-neutral-100"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-semibold text-neutral-900">Enterprise AI</span>
        </header>

        <main id="main-content" className="flex min-h-0 flex-1 flex-col bg-white">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
