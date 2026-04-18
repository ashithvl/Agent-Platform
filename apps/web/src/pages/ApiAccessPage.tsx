import { useMemo, useState } from "react";

import { isCustomWorkflow } from "../lib/workflowStorage";
import { apiKeyForWorkflow, mockInvokeUrl } from "../lib/mockApiKey";
import { useWorkflowCatalog } from "../lib/useWorkflowCatalog";

const defaultBase = import.meta.env.VITE_MOCK_API_BASE ?? "https://api.enterprise-ai.local/v1";

export default function ApiAccessPage() {
  const workflows = useWorkflowCatalog();
  const [base, setBase] = useState(defaultBase);
  const [openId, setOpenId] = useState<string | null>(workflows[0]?.id ?? null);

  const rows = useMemo(
    () =>
      workflows.map((w) => ({
        workflow: w,
        url: mockInvokeUrl(w.id, base),
        key: apiKeyForWorkflow(w),
        custom: isCustomWorkflow(w),
      })),
    [base, workflows],
  );

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <header className="border-b border-neutral-200 pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">API access</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Every workflow has a dedicated invoke URL and API key. Use the key in the{" "}
          <code className="rounded bg-neutral-100 px-1 text-xs">Authorization: Bearer</code> header.
        </p>
      </header>

      <div className="mt-6 max-w-xl">
        <label className="block text-sm font-medium text-neutral-700">API base URL</label>
        <input
          type="url"
          className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
          value={base}
          onChange={(e) => setBase(e.target.value)}
        />
      </div>

      <div className="mt-8 space-y-4">
        {rows.map(({ workflow: w, url, key, custom }) => (
          <article key={w.id} className="rounded-lg border border-neutral-200 bg-white shadow-sm">
            <button
              type="button"
              onClick={() => setOpenId((v) => (v === w.id ? null : w.id))}
              className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-neutral-50"
            >
              <span className="flex flex-col gap-0.5">
                <span className="font-semibold text-neutral-900">{w.name}</span>
                {custom ? (
                  <span className="text-[11px] text-neutral-500">Developer workflow · created by {w.createdBy}</span>
                ) : (
                  <span className="text-[11px] text-neutral-500">System workflow</span>
                )}
              </span>
              <span className="text-xs text-neutral-500">{openId === w.id ? "Hide" : "Show credentials"}</span>
            </button>
            {openId === w.id ? (
              <div className="space-y-3 border-t border-neutral-200 px-4 py-4 text-sm">
                <div>
                  <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Invoke URL</span>
                  <div className="mt-1 flex gap-2">
                    <code className="flex-1 break-all rounded bg-neutral-100 px-2 py-2 text-neutral-800">{url}</code>
                    <CopyButton text={url} />
                  </div>
                </div>
                <div>
                  <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">API key (this flow)</span>
                  <div className="mt-1 flex gap-2">
                    <code className="flex-1 break-all rounded bg-neutral-100 px-2 py-2 text-neutral-800">{key}</code>
                    <CopyButton text={key} />
                  </div>
                </div>
                <p className="text-xs text-neutral-500">
                  Header: <code className="rounded bg-neutral-200 px-1">Authorization: Bearer {`{key}`}</code>
                </p>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="shrink-0 rounded-md border border-neutral-300 bg-white px-3 py-2 text-xs font-medium text-neutral-800 hover:bg-neutral-100"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          window.setTimeout(() => setDone(false), 2000);
        } catch {
          /* ignore */
        }
      }}
    >
      {done ? "Copied" : "Copy"}
    </button>
  );
}
