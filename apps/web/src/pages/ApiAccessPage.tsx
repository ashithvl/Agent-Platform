import { useId, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { EmptyState } from "../components/EmptyState";
import { useFlash } from "../components/FlashContext";
import { PageChrome } from "../components/PageChrome";
import { isCustomWorkflow } from "../lib/workflowStorage";
import { apiKeyForWorkflow, mockInvokeUrl } from "../lib/mockApiKey";
import { useWorkflowCatalog } from "../lib/useWorkflowCatalog";

const defaultBase = import.meta.env.VITE_MOCK_API_BASE ?? "https://api.enterprise-ai.local/v1";

export default function ApiAccessPage() {
  const baseUrlFieldId = useId();
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
    <PageChrome
      title="API access"
      description={
        <>
          Every workflow has a dedicated invoke URL and API key. Use the key in the{" "}
          <code className="rounded bg-neutral-100 px-1 text-xs">Authorization: Bearer</code> header.
        </>
      }
    >
      <div className="mt-6 max-w-xl">
        <label htmlFor={baseUrlFieldId} className="block text-sm font-medium text-neutral-700">
          API base URL
        </label>
        <input
          id={baseUrlFieldId}
          type="url"
          className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
          value={base}
          onChange={(e) => setBase(e.target.value)}
        />
      </div>

      {rows.length === 0 ? (
        <div className="mt-8 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50/60">
          <EmptyState
            visual="key"
            title="No workflows to show keys for"
            description="Invoke URLs and API keys are listed per workflow. If your catalog is empty, create a workflow from the Workflow page (or restore seed data), then return here."
            action={
              <Link
                to="/workflows"
                className="inline-flex rounded-md bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800"
              >
                Open workflow catalog
              </Link>
            }
          />
        </div>
      ) : (
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
      )}
    </PageChrome>
  );
}

function CopyButton({ text }: { text: string }) {
  const { showError } = useFlash();
  const [done, setDone] = useState(false);
  const [inlineErr, setInlineErr] = useState<string | null>(null);

  const runCopy = async () => {
    setInlineErr(null);
    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== "function") {
      const msg =
        "Clipboard API is unavailable (try HTTPS, or copy the value manually from the gray box).";
      showError(msg);
      setInlineErr(msg);
      window.setTimeout(() => setInlineErr(null), 8000);
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      window.setTimeout(() => setDone(false), 2000);
    } catch {
      const msg = "Could not copy — allow clipboard permission for this site, or select the text and copy manually.";
      showError(msg);
      setInlineErr(msg);
      window.setTimeout(() => setInlineErr(null), 8000);
    }
  };

  return (
    <div className="flex shrink-0 flex-col items-stretch gap-1">
      <button
        type="button"
        className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-xs font-medium text-neutral-800 hover:bg-neutral-100"
        onClick={() => void runCopy()}
      >
        {done ? "Copied" : "Copy"}
      </button>
      {inlineErr ? (
        <p className="max-w-[11rem] text-right text-[11px] leading-snug text-red-700" role="alert">
          {inlineErr}
        </p>
      ) : null}
    </div>
  );
}
