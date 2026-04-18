import { type FormEvent, useEffect, useState } from "react";

import { useFlash } from "../FlashContext";
import {
  type AddAdminModelRequest,
  type LiteLLMAdminModel,
  addAdminModel,
  deleteAdminModel,
  listAdminModels,
} from "../../lib/litellmAdmin";
import { Dialog } from "../Dialog";

export function ModelsTab() {
  const { showSuccess, showError } = useFlash();
  const [models, setModels] = useState<LiteLLMAdminModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      setModels(await listAdminModels());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const onDelete = async (id: string | undefined) => {
    if (!id) return;
    if (!window.confirm("Remove this model from the LiteLLM gateway?")) return;
    try {
      await deleteAdminModel(id);
      showSuccess("Model removed.");
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
            LiteLLM models
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            The live model catalog served by the LiteLLM gateway. Every SPA dropdown reads from this list.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="shrink-0 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          Add model
        </button>
      </div>

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
              <th className="px-4 py-3">Provider model</th>
              <th className="hidden px-4 py-3 md:table-cell">Input $ / 1k tok</th>
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
            ) : models.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-neutral-500">
                  No models configured. Add one to get started.
                </td>
              </tr>
            ) : (
              models.map((m) => {
                const id = (m.model_info?.id as string | undefined) ?? "";
                const costPerToken =
                  typeof m.model_info?.input_cost_per_token === "number"
                    ? (m.model_info.input_cost_per_token as number)
                    : null;
                return (
                  <tr key={`${m.model_name}:${id}`} className="odd:bg-white even:bg-neutral-50/60">
                    <td className="px-4 py-3 font-medium text-neutral-900">{m.model_name}</td>
                    <td className="px-4 py-3 text-neutral-700">
                      <code className="text-xs">{String(m.litellm_params?.model ?? "—")}</code>
                    </td>
                    <td className="hidden px-4 py-3 text-neutral-700 md:table-cell">
                      {costPerToken !== null ? `$${(costPerToken * 1000).toFixed(4)}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => onDelete(id)}
                        className="text-xs font-medium text-red-700 underline"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <AddModelDialog
        open={open}
        onClose={() => setOpen(false)}
        onSaved={async () => {
          setOpen(false);
          showSuccess("Model added.");
          await refresh();
        }}
        onError={(msg) => showError(msg)}
      />
    </section>
  );
}

function AddModelDialog({
  open,
  onClose,
  onSaved,
  onError,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
  onError: (message: string) => void;
}) {
  const [alias, setAlias] = useState("");
  const [provider, setProvider] = useState("");
  const [apiKeyEnv, setApiKeyEnv] = useState("os.environ/OPENAI_API_KEY");
  const [inputCostPer1k, setInputCostPer1k] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setAlias("");
      setProvider("");
      setApiKeyEnv("os.environ/OPENAI_API_KEY");
      setInputCostPer1k("");
      setBusy(false);
    }
  }, [open]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload: AddAdminModelRequest = {
        model_name: alias.trim(),
        litellm_params: {
          model: provider.trim(),
          api_key: apiKeyEnv.trim(),
        },
      };
      const cost = parseFloat(inputCostPer1k);
      if (!Number.isNaN(cost) && cost > 0) {
        payload.model_info = { input_cost_per_token: cost / 1000 };
      }
      await addAdminModel(payload);
      await onSaved();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Add LiteLLM model" size="md">
      <form onSubmit={submit} className="grid gap-4">
        <Field label="Alias" hint="Shown in SPA dropdowns and used in API requests.">
          <input
            required
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            placeholder="e.g. gpt-4o-mini"
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Provider model" hint="LiteLLM routing string, e.g. openai/gpt-4o-mini or anthropic/claude-3-5-sonnet-20241022.">
          <input
            required
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            placeholder="openai/gpt-4o-mini"
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
          />
        </Field>
        <Field label="API key reference" hint="Use `os.environ/VAR_NAME` to read from the LiteLLM container's env.">
          <input
            value={apiKeyEnv}
            onChange={(e) => setApiKeyEnv(e.target.value)}
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Input cost per 1k tokens (USD)" hint="Optional. Used by Langfuse rollups for cost display.">
          <input
            type="number"
            min="0"
            step="0.0001"
            value={inputCostPer1k}
            onChange={(e) => setInputCostPer1k(e.target.value)}
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
          />
        </Field>
        <div className="flex justify-end gap-2 border-t border-neutral-200 pt-4">
          <button type="button" onClick={onClose} className="rounded-md border border-neutral-300 px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {busy ? "Adding…" : "Add model"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium text-neutral-800">{label}</span>
      {children}
      {hint ? <span className="text-xs text-neutral-500">{hint}</span> : null}
    </label>
  );
}
