import { Link } from "react-router-dom";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-neutral-900">
      <header className="border-b border-neutral-200">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <span className="text-sm font-semibold tracking-tight">Enterprise AI</span>
          <Link
            to="/login"
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            Sign in
          </Link>
        </div>
      </header>
      <main className="mx-auto flex max-w-2xl flex-1 flex-col justify-center px-6 py-20 text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-neutral-900">Operations-grade AI workspace</h1>
        <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-neutral-600">
          Dashboards, workflows, API keys, chat, guardrails, and telemetry — wired in the client for demos. Sign in to
          continue.
        </p>
        <div className="mt-10">
          <Link
            to="/login"
            className="inline-flex rounded-md border border-neutral-300 bg-white px-6 py-2.5 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
          >
            Go to sign in
          </Link>
        </div>
      </main>
      <footer className="border-t border-neutral-200 py-6 text-center text-xs text-neutral-500">Local demo — no backend required.</footer>
    </div>
  );
}
