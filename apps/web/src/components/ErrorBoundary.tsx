import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };

type State = {
  hasError: boolean;
  error: Error | null;
};

function toError(err: unknown): Error {
  if (err instanceof Error) return err;
  return new Error(typeof err === "string" ? err : "Unknown error");
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { hasError: true, error: toError(error) };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[ErrorBoundary]", error.message, info.componentStack);
  }

  render(): ReactNode {
    const { hasError, error } = this.state;
    if (hasError && error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6 py-12 text-neutral-900">
          <div className="w-full max-w-md rounded-lg border border-neutral-200 bg-neutral-50/80 p-6 shadow-sm">
            <h1 className="text-lg font-semibold tracking-tight">Something went wrong</h1>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">
              The UI hit an unexpected error. You can reload the page or return to the home screen. If this keeps
              happening, try clearing site data for this origin.
            </p>
            <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 font-mono text-xs text-red-900">
              {error.message}
            </p>
            {import.meta.env.DEV && error.stack ? (
              <pre className="mt-4 max-h-48 overflow-auto rounded-md border border-neutral-200 bg-white p-3 text-[11px] leading-snug text-neutral-700">
                {error.stack}
              </pre>
            ) : null}
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                className="rounded-md bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800"
                onClick={() => window.location.reload()}
              >
                Reload page
              </button>
              <button
                type="button"
                className="rounded-md border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
                onClick={() => {
                  const root = new URL(import.meta.env.BASE_URL, window.location.origin).href;
                  window.location.assign(root);
                }}
              >
                Go to home
              </button>
            </div>
            <p className="mt-4 text-xs text-neutral-500">
              &quot;Go to home&quot; opens the app root and clears this error. &quot;Reload page&quot; retries the current URL.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
