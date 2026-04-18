import { type FormEvent, useCallback, useMemo, useState } from "react";

import { useAuth } from "../auth/AuthContext";
import { createLocalUser, listUsersPublic, type CreatableRole } from "../auth/localUsers";

export default function SettingsPage() {
  const { user, realmRoles } = useAuth();
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
    <div className="mx-auto max-w-3xl px-6 py-10">
      <header className="border-b border-neutral-200 pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Settings</h1>
        <p className="mt-1 text-sm text-neutral-600">Profile and local account management.</p>
      </header>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Session</h2>
        <dl className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50/50 p-4 text-sm">
          <div className="flex justify-between gap-4 py-1">
            <dt className="text-neutral-600">User</dt>
            <dd className="font-medium text-neutral-900">{user?.profile.preferred_username ?? user?.sub}</dd>
          </div>
          <div className="flex justify-between gap-4 py-1">
            <dt className="text-neutral-600">Roles</dt>
            <dd className="text-right font-medium text-neutral-900">{[...realmRoles].join(", ") || "—"}</dd>
          </div>
        </dl>
      </section>

      <section className="mt-10 border-t border-neutral-200 pt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">People (this browser)</h2>
        <p className="mt-2 text-sm text-neutral-600">
          Accounts persist in <code className="rounded bg-neutral-100 px-1 text-xs">localStorage</code>. Seeded
          logins: <code className="text-xs">admin</code>/<code className="text-xs">admin</code>,{" "}
          <code className="text-xs">developer</code>/<code className="text-xs">developer</code>,{" "}
          <code className="text-xs">user</code>/<code className="text-xs">user</code>.
        </p>

        <div className="mt-4 overflow-hidden rounded-lg border border-neutral-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-2">Username</th>
                <th className="px-4 py-2">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 bg-white">
              {sorted.map((u) => (
                <tr key={u.username}>
                  <td className="px-4 py-2 font-medium text-neutral-900">{u.username}</td>
                  <td className="px-4 py-2 text-neutral-700">{u.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {canManage ? (
          <form onSubmit={onCreate} className="mt-6 max-w-md space-y-4 rounded-lg border border-neutral-200 p-4">
            <h3 className="text-sm font-semibold text-neutral-900">Create user</h3>
            <div>
              <label className="block text-sm font-medium text-neutral-700">Username</label>
              <input
                type="text"
                required
                autoComplete="off"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700">Password</label>
              <input
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as CreatableRole)}
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
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
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              {busy ? "Creating…" : "Create user"}
            </button>
          </form>
        ) : (
          <p className="mt-4 text-sm text-neutral-500">Only administrators can create users.</p>
        )}
      </section>
    </div>
  );
}
