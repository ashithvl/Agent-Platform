import { type FormEvent, useId, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { PageBusy } from "../components/PageBusy";
import { SkipToMain } from "../components/SkipToMain";

export default function Login() {
  const { user, loading, login, error } = useAuth();
  const formId = useId();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);

  if (loading) {
    return <PageBusy message="Checking session…" layout="fullscreen" />;
  }
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setLocalErr(null);
    setBusy(true);
    void login(username.trim(), password)
      .then(() => navigate("/dashboard", { replace: true }))
      .catch((err: unknown) => {
        setLocalErr(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setBusy(false));
  };

  const displayErr = localErr ?? error;

  return (
    <div className="flex min-h-screen flex-col bg-white text-neutral-900">
      <SkipToMain />
      <header className="border-b border-neutral-200">
        <div className="mx-auto flex h-14 max-w-lg items-center px-6">
          <Link to="/" className="text-sm font-semibold tracking-tight hover:underline">
            Enterprise AI
          </Link>
        </div>
      </header>
      <div id="main-content" className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-12">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-2 text-sm text-neutral-600">Use your workspace username and password. Data stays in this browser.</p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div>
            <label htmlFor={`${formId}-username`} className="block text-sm font-medium text-neutral-700">
              Username
            </label>
            <input
              id={`${formId}-username`}
              type="text"
              name="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
            />
          </div>
          <div>
            <label htmlFor={`${formId}-password`} className="block text-sm font-medium text-neutral-700">
              Password
            </label>
            <input
              id={`${formId}-password`}
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
            />
          </div>
          {displayErr ? (
            <p role="alert" className="text-sm text-red-600">
              {displayErr}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-neutral-900 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-xs leading-relaxed text-neutral-500">
          Demo: <code className="text-neutral-700">admin</code>/<code className="text-neutral-700">admin</code> (Settings,
          API access), <code className="text-neutral-700">developer</code>/<code className="text-neutral-700">developer</code>{" "}
          (workspace builder, no API keys), <code className="text-neutral-700">user</code>/
          <code className="text-neutral-700">user</code> (same workspace, no API keys). Only admins manage people under
          Settings.
        </p>
        <p className="mt-4 text-center text-sm">
          <Link to="/" className="text-neutral-600 underline-offset-4 hover:underline">
            Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
