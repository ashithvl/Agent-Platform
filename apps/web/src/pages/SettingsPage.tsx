import { type FormEvent, useCallback, useId, useMemo, useState } from "react";

import { useAuth } from "../auth/AuthContext";
import { useFlash } from "../components/FlashContext";
import { PageChrome } from "../components/PageChrome";
import { createLocalUser, listUsersPublic, type CreatableRole } from "../auth/localUsers";

export default function SettingsPage() {
  const { user, realmRoles } = useAuth();
  const createUserFormId = useId();
  const { showSuccess } = useFlash();
  const [users, setUsers] = useState(() => listUsersPublic());
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<CreatableRole>("user");
  const [formErr, setFormErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canManage = realmRoles.has("admin") || realmRoles.has("platform-admin");
  const refresh = useCallback(() => setUsers(listUsersPublic()), []);

  const onCreate = (e: FormEvent) => {
    e.preventDefault();
    if (!canManage) return;
    setFormErr(null);
    setBusy(true);
    try {
      createLocalUser(realmRoles, username, password, role);
      setUsername("");
      setPassword("");
      setRole("user");
      refresh();
      showSuccess("User created.");
    } catch (err) {
      setFormErr(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const sorted = useMemo(
    () => [...users].sort((a, b) => a.username.localeCompare(b.username, undefined, { sensitivity: "base" })),
    [users],
  );

  return (
    <PageChrome
      title="Settings"
      description="Profile and local account management. Layout matches other workspace pages."
    >
      <section className="mt-8 rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Session</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-md border border-neutral-100 bg-neutral-50/80 px-3 py-2">
            <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">User</dt>
            <dd className="mt-1 font-medium text-neutral-900">{user?.profile.preferred_username ?? user?.sub}</dd>
          </div>
          <div className="rounded-md border border-neutral-100 bg-neutral-50/80 px-3 py-2">
            <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">Roles</dt>
            <dd className="mt-1 font-medium text-neutral-900">{[...realmRoles].join(", ") || "—"}</dd>
          </div>
        </dl>
      </section>

      {canManage ? (
        <section className="mt-10 rounded-lg border border-neutral-200 bg-neutral-50/40 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Create user</h2>
          <p className="mt-2 text-sm text-neutral-600">
            New accounts are stored in this browser only. Place this block at the top so it stays easy to find.
          </p>
          <form onSubmit={onCreate} className="mt-6 grid gap-4 border-t border-neutral-200 pt-6 sm:max-w-xl">
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
                onChange={(e) => setUsername(e.target.value)}
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
                onChange={(e) => setPassword(e.target.value)}
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
                <option value="user">User — Full workspace, no API keys</option>
                <option value="developer">Developer — Same as user, plus API access and keys</option>
                <option value="admin">Admin — Full access</option>
              </select>
            </div>
            {formErr ? (
              <p className="text-sm text-red-600" role="alert">
                {formErr}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={busy}
              className="w-fit rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              {busy ? "Creating…" : "Create user"}
            </button>
          </form>
        </section>
      ) : null}

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">People (this browser)</h2>
        <p className="mt-2 text-sm text-neutral-600">
          Accounts persist in <code className="rounded bg-neutral-100 px-1 text-xs">localStorage</code>. Seeded logins:{" "}
          <code className="text-xs">admin</code>/<code className="text-xs">admin</code>,{" "}
          <code className="text-xs">developer</code>/<code className="text-xs">developer</code>,{" "}
          <code className="text-xs">user</code>/<code className="text-xs">user</code>.
        </p>

        <div className="mt-4 overflow-hidden rounded-lg border border-neutral-200 shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-100 text-xs font-semibold uppercase tracking-wide text-neutral-600">
              <tr>
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3">Role label</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 bg-white">
              {sorted.map((u) => (
                <tr key={u.username} className="odd:bg-white even:bg-neutral-50/60">
                  <td className="px-4 py-3 font-medium text-neutral-900">{u.username}</td>
                  <td className="px-4 py-3 text-neutral-700">{u.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!canManage ? (
          <p className="mt-4 text-sm text-neutral-500">Only administrators can create users.</p>
        ) : null}
      </section>
    </PageChrome>
  );
}
