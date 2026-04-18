import { Link } from "react-router-dom";

import { SkipToMain } from "../components/SkipToMain";

/** Unknown routes — clearer than silently redirecting home. */
export default function NotFoundPage() {
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
      <main id="main-content" className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16 text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-neutral-500">404</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">Page not found</h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-600">
          That URL does not match any screen in this app. Check the address for typos, or go back to the workspace
          home.
        </p>
        <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link
            to="/"
            className="inline-flex justify-center rounded-md bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800"
          >
            Home
          </Link>
          <Link
            to="/login"
            className="inline-flex justify-center rounded-md border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
          >
            Sign in
          </Link>
        </div>
      </main>
    </div>
  );
}
