import { type FormEvent, useEffect, useState } from "react";

import { useFlash } from "../FlashContext";
import {
  type LiteLLMBudget,
  deleteAdminBudget,
  listAdminBudgets,
  upsertAdminBudget,
} from "../../lib/litellmAdmin";
import { Dialog } from "../Dialog";

export function BudgetsTab() {
  const { showSuccess, showError } = useFlash();
  const [budgets, setBudgets] = useState<LiteLLMBudget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      setBudgets(await listAdminBudgets());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const onDelete = async (id: string) => {
    if (!window.confirm(`Delete budget "${id}"?`)) return;
    try {
      await deleteAdminBudget(id);
      showSuccess("Budget deleted.");
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
            Budgets
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            Assign budgets to teams or attach them to virtual keys so cost never runs away silently.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="shrink-0 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          New budget
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
              <th className="px-4 py-3">Budget id</th>
              <th className="px-4 py-3">Max</th>
              <th className="hidden px-4 py-3 md:table-cell">Duration</th>
              <th className="hidden px-4 py-3 md:table-cell">Spend</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 bg-white">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-neutral-500">
                  Loading…
                </td>
              </tr>
            ) : budgets.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-neutral-500">
                  No budgets yet.
                </td>
              </tr>
            ) : (
              budgets.map((b) => (
                <tr key={b.budget_id} className="odd:bg-white even:bg-neutral-50/60">
                  <td className="px-4 py-3 font-medium text-neutral-900">{b.budget_id}</td>
                  <td className="px-4 py-3 text-neutral-700">${b.max_budget.toFixed(2)}</td>
                  <td className="hidden px-4 py-3 text-neutral-700 md:table-cell">
                    {b.budget_duration ?? "—"}
                  </td>
                  <td className="hidden px-4 py-3 text-neutral-700 md:table-cell">
                    {typeof b.spend === "number" ? `$${b.spend.toFixed(2)}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => onDelete(b.budget_id)}
                      className="text-xs font-medium text-red-700 underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <UpsertBudgetDialog
        open={open}
        onClose={() => setOpen(false)}
        onSaved={async () => {
          setOpen(false);
          showSuccess("Budget saved.");
          await refresh();
        }}
        onError={(msg) => showError(msg)}
      />
    </section>
  );
}

function UpsertBudgetDialog({
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
  const [budgetId, setBudgetId] = useState("");
  const [maxBudget, setMaxBudget] = useState("");
  const [duration, setDuration] = useState("monthly");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setBudgetId("");
      setMaxBudget("");
      setDuration("monthly");
      setBusy(false);
    }
  }, [open]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const amt = parseFloat(maxBudget);
      if (Number.isNaN(amt) || amt <= 0) throw new Error("Max budget must be a positive number");
      await upsertAdminBudget({
        budget_id: budgetId.trim(),
        max_budget: amt,
        budget_duration: duration.trim() || "monthly",
      });
      await onSaved();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Create / update budget" size="md">
      <form onSubmit={submit} className="grid gap-4">
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-neutral-800">Budget id</span>
          <input
            required
            value={budgetId}
            onChange={(e) => setBudgetId(e.target.value)}
            placeholder="e.g. team-platform-monthly"
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-neutral-800">Max budget (USD)</span>
          <input
            required
            type="number"
            min="0"
            step="0.01"
            value={maxBudget}
            onChange={(e) => setMaxBudget(e.target.value)}
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-neutral-800">Duration</span>
          <input
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="monthly, weekly, daily"
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
            {busy ? "Saving…" : "Save budget"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
