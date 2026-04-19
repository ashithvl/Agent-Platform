import { type FormEvent, useCallback, useEffect, useId, useMemo, useState } from "react";

import { useAuth } from "../auth/AuthContext";
import type { CreatableRole } from "../auth/types";
import { backendCreateUser, backendListUsers } from "../auth/backendAuth";
import { Dialog } from "../components/Dialog";
import { EmptyTablePlaceholder } from "../components/EmptyTablePlaceholder";
import { useFlash } from "../components/FlashContext";
import { PageChrome } from "../components/PageChrome";
import { BudgetsTab } from "../components/settings/BudgetsTab";
import { KeysTab } from "../components/settings/KeysTab";
import { ModelsTab } from "../components/settings/ModelsTab";
import { ObservabilityTab } from "../components/settings/ObservabilityTab";

type SettingsTab = "session" | "people" | "models" | "keys" | "budgets" | "observability";

export default function SettingsPage() {
  const { user, realmRoles } = useAuth();
  const tabsId = useId();
  const createUserFormId = useId();
  const { showSuccess } = useFlash();
  const [tab, setTab] = useState<SettingsTab>("people");
  const [users, setUsers] = useState<{ username: string; roles: string[]; label: string }[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<CreatableRole>("user");
  const [formErr, setFormErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canManage = realmRoles.has("admin") || realmRoles.has("platform-admin");
  const refresh = useCallback(() => {
    backendListUsers()
      .then(setUsers)
      .catch(() => setUsers([]));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const sorted = useMemo(
    () => [...users].sort((a, b) => a.username.localeCompare(b.username, undefined, { sensitivity: "base" })),
    [users],
  );

  const resetCreateForm = () => {
    setUsername("");
    setPassword("");
    setRole("user");
    setFormErr(null);
  };

  const closeCreate = () => {
    setCreateOpen(false);
    resetCreateForm();
  };

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!canManage) return;
    setFormErr(null);
    setBusy(true);
    try {
      await backendCreateUser(username, password, role);
      refresh();
      showSuccess("User created.");
      closeCreate();
    } catch (err) {
      setFormErr(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const tabBtn = (id: SettingsTab, label: string) => (
    <button
      key={id}
      type="button"
      role="tab"
      id={`${tabsId}-${id}`}
      aria-selected={tab === id}
      aria-controls={`${tabsId}-panel-${id}`}
      tabIndex={tab === id ? 0 : -1}
      onClick={() => setTab(id)}
      className={[
        "-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
        tab === id
          ? "border-neutral-900 text-neutral-900"
          : "border-transparent text-neutral-500 hover:text-neutral-800",
      ].join(" ")}
    >
      {label}
    </button>
  );

  return (
    <PageChrome
      title="Settings"
      description="Session details and workspace accounts from auth-service. Use the People tab to list users; admins create accounts from a dialog."
    >
      <div className="mt-6 border-b border-neutral-200" role="tablist" aria-label="Settings sections">
        <div className="flex flex-wrap gap-1">
          {tabBtn("session", "Session")}
          {tabBtn("people", "People")}
          {canManage ? tabBtn("models", "Models") : null}
          {canManage ? tabBtn("keys", "Virtual keys") : null}
          {canManage ? tabBtn("budgets", "Budgets") : null}
          {canManage ? tabBtn("observability", "Observability") : null}
        </div>
      </div>

      <div
        role="tabpanel"
        id={`${tabsId}-panel-session`}
        aria-labelledby={`${tabsId}-session`}
        hidden={tab !== "session"}
        tabIndex={-1}
        className="mt-8 outline-none"
      >
        <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Current session</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Who is signed in and which roles this session carries (from the demo token in this browser).
          </p>
          <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-md border border-neutral-100 bg-neutral-50/80 px-3 py-2">
              <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">Signed in as</dt>
              <dd className="mt-1 font-medium text-neutral-900">{user?.profile.preferred_username ?? user?.sub}</dd>
            </div>
            <div className="rounded-md border border-neutral-100 bg-neutral-50/80 px-3 py-2">
              <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">Roles</dt>
              <dd className="mt-1 font-medium text-neutral-900">{[...realmRoles].join(", ") || "—"}</dd>
            </div>
          </dl>
        </section>
      </div>

      <div
        role="tabpanel"
        id={`${tabsId}-panel-people`}
        aria-labelledby={`${tabsId}-people`}
        hidden={tab !== "people"}
        tabIndex={-1}
        className="mt-8 outline-none"
      >
        <section>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">All users</h2>
              <p className="mt-1 text-sm text-neutral-600">
                Accounts from <code className="rounded bg-neutral-100 px-1 text-xs">auth-service</code>. Seeded:{" "}
                <code className="text-xs">admin</code>, <code className="text-xs">developer</code>,{" "}
                <code className="text-xs">user</code>.
              </p>
            </div>
            {canManage ? (
              <button
                type="button"
                onClick={() => {
                  resetCreateForm();
                  setCreateOpen(true);
                }}
                className="shrink-0 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
              >
                Create user
              </button>
            ) : null}
          </div>

          <div className="mt-6 overflow-hidden rounded-lg border border-neutral-200 shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-100 text-xs font-semibold uppercase tracking-wide text-neutral-600">
                <tr>
                  <th className="px-4 py-3">Username</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="hidden px-4 py-3 sm:table-cell">Realm roles</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 bg-white">
                {sorted.length === 0 ? (
                  <EmptyTablePlaceholder
                    colSpan={3}
                    visual="users"
                    title="No local accounts found"
                    description="Seeded users should appear after first load. Refresh the page if this table stays empty."
                  />
                ) : (
                  sorted.map((u) => (
                    <tr key={u.username} className="odd:bg-white even:bg-neutral-50/60">
                      <td className="px-4 py-3 font-medium text-neutral-900">{u.username}</td>
                      <td className="px-4 py-3 text-neutral-700">{u.label}</td>
                      <td className="hidden max-w-md px-4 py-3 text-xs text-neutral-600 sm:table-cell">
                        {u.roles.length ? u.roles.join(", ") : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {!canManage ? (
            <p className="mt-4 text-sm text-neutral-500">Only administrators can create new users.</p>
          ) : null}
        </section>
      </div>

      {canManage ? (
        <>
          <div
            role="tabpanel"
            id={`${tabsId}-panel-models`}
            aria-labelledby={`${tabsId}-models`}
            hidden={tab !== "models"}
            tabIndex={-1}
            className="mt-8 outline-none"
          >
            <ModelsTab />
          </div>

          <div
            role="tabpanel"
            id={`${tabsId}-panel-keys`}
            aria-labelledby={`${tabsId}-keys`}
            hidden={tab !== "keys"}
            tabIndex={-1}
            className="mt-8 outline-none"
          >
            <KeysTab />
          </div>

          <div
            role="tabpanel"
            id={`${tabsId}-panel-budgets`}
            aria-labelledby={`${tabsId}-budgets`}
            hidden={tab !== "budgets"}
            tabIndex={-1}
            className="mt-8 outline-none"
          >
            <BudgetsTab />
          </div>

          <div
            role="tabpanel"
            id={`${tabsId}-panel-observability`}
            aria-labelledby={`${tabsId}-observability`}
            hidden={tab !== "observability"}
            tabIndex={-1}
            className="mt-8 outline-none"
          >
            <ObservabilityTab />
          </div>
        </>
      ) : null}

      <Dialog open={createOpen} onClose={closeCreate} title="Create user" description="Stored in this browser only — demo accounts." size="md">
        <form onSubmit={onCreate} className="grid gap-4">
          <div>
            <label htmlFor={`${createUserFormId}-username`} className="block text-sm font-medium text-neutral-700">
              Username
            </label>
            <input
              id={`${createUserFormId}-username`}
              type="text"
              required
              autoComplete="off"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setFormErr(null);
              }}
              className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor={`${createUserFormId}-password`} className="block text-sm font-medium text-neutral-700">
              Password
            </label>
            <input
              id={`${createUserFormId}-password`}
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setFormErr(null);
              }}
              className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor={`${createUserFormId}-role`} className="block text-sm font-medium text-neutral-700">
              Role
            </label>
            <select
              id={`${createUserFormId}-role`}
              value={role}
              onChange={(e) => setRole(e.target.value as CreatableRole)}
              className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
            >
              <option value="user">User — Full workspace access</option>
              <option value="developer">Developer — Workspace builder</option>
              <option value="admin">Admin — Full access incl. Settings</option>
            </select>
          </div>
          {formErr ? (
            <p className="text-sm text-red-600" role="alert">
              {formErr}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2 border-t border-neutral-200 pt-4">
            <button type="button" className="rounded-md border border-neutral-300 px-4 py-2 text-sm" onClick={closeCreate}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              {busy ? "Creating…" : "Create user"}
            </button>
          </div>
        </form>
      </Dialog>
    </PageChrome>
  );
}
