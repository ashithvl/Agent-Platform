import { type FormEvent, useEffect, useState } from "react";

import { useFlash } from "../FlashContext";
import {
  type CreateKeyRequest,
  type LiteLLMVirtualKey,
  createAdminKey,
  deleteAdminKeys,
  listAdminKeys,
} from "../../lib/litellmAdmin";
import { Dialog } from "../Dialog";

export function KeysTab() {
  const { showSuccess, showError } = useFlash();
  const [keys, setKeys] = useState<LiteLLMVirtualKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [lastCreated, setLastCreated] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      setKeys(await listAdminKeys());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const onDelete = async (tok: string | undefined) => {
    if (!tok) return;
    if (!window.confirm("Revoke this virtual key? Calls using it will start to 401.")) return;
    try {
      await deleteAdminKeys([tok]);
      showSuccess("Key revoked.");
      await refresh();
    } catch (err) {
      showError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <section>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Virtual keys
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            LiteLLM virtual keys scope access to a subset of models with per-key budgets. The master key never leaves api-service.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="shrink-0 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          Create key
        </button>
      </div>

      {lastCreated ? (
        <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm">
          <p className="font-medium text-emerald-950">Copy this key now — it will not be shown again.</p>
          <code className="mt-2 block break-all rounded bg-white px-2 py-2 text-xs text-emerald-900">
            {lastCreated}
          </code>
          <button
            type="button"
            onClick={() => setLastCreated(null)}
            className="mt-2 text-xs font-medium text-emerald-800 underline"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-6 overflow-hidden rounded-lg border border-neutral-200 shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-100 text-xs font-semibold uppercase tracking-wide text-neutral-600">
            <tr>
              <th className="px-4 py-3">Alias</th>
              <th className="px-4 py-3">Models</th>
              <th className="hidden px-4 py-3 md:table-cell">Spend / budget</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 bg-white">
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-neutral-500">
                  Loading…
                </td>
              </tr>
            ) : keys.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-neutral-500">
                  No virtual keys yet.
                </td>
              </tr>
            ) : (
              keys.map((k) => {
                const tok = k.token ?? k.key ?? "";
                const spend = typeof k.spend === "number" ? k.spend.toFixed(2) : "0.00";
                const budget =
                  typeof k.max_budget === "number" ? `$${k.max_budget.toFixed(2)}` : "—";
                return (
                  <tr key={tok} className="odd:bg-white even:bg-neutral-50/60">
                    <td className="px-4 py-3 font-medium text-neutral-900">
                      {k.key_alias ?? <span className="text-neutral-500">(no alias)</span>}
                    </td>
                    <td className="px-4 py-3 text-neutral-700">
                      {k.models?.length ? k.models.join(", ") : <span className="text-neutral-500">any</span>}
                    </td>
                    <td className="hidden px-4 py-3 text-neutral-700 md:table-cell">
                      ${spend} / {budget}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => onDelete(tok)}
                        className="text-xs font-medium text-red-700 underline"
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <CreateKeyDialog
        open={open}
        onClose={() => setOpen(false)}
        onSaved={async (created) => {
          setOpen(false);
          setLastCreated(created);
          showSuccess("Key created.");
          await refresh();
        }}
        onError={(msg) => showError(msg)}
      />
    </section>
  );
}

function CreateKeyDialog({
  open,
  onClose,
  onSaved,
  onError,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (createdKey: string) => void | Promise<void>;
  onError: (message: string) => void;
}) {
  const [alias, setAlias] = useState("");
  const [models, setModels] = useState("");
  const [budget, setBudget] = useState<string>("");
  const [duration, setDuration] = useState("30d");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setAlias("");
      setModels("");
      setBudget("");
      setDuration("30d");
      setBusy(false);
    }
  }, [open]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload: CreateKeyRequest = { key_alias: alias.trim() || undefined };
      const modelsList = models
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean);
      if (modelsList.length) payload.models = modelsList;
      const b = parseFloat(budget);
      if (!Number.isNaN(b) && b > 0) payload.max_budget = b;
      if (duration.trim()) payload.duration = duration.trim();

      const created = await createAdminKey(payload);
      await onSaved(created.key ?? created.token ?? "(no token in response)");
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Create virtual key" size="md">
      <form onSubmit={submit} className="grid gap-4">
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-neutral-800">Alias</span>
          <input
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            placeholder="e.g. backoffice-rag"
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-neutral-800">Allowed models</span>
          <input
            value={models}
            onChange={(e) => setModels(e.target.value)}
            placeholder="comma-separated, blank = all"
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-neutral-800">Max budget (USD)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-neutral-800">Duration</span>
          <input
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="e.g. 30d, 24h"
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
          />
        </label>
        <div className="flex justify-end gap-2 border-t border-neutral-200 pt-4">
          <button type="button" onClick={onClose} className="rounded-md border border-neutral-300 px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create key"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
