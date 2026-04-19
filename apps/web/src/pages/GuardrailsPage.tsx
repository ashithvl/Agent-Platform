import { type FormEvent, useCallback, useId, useState } from "react";

import { useAuth } from "../auth/AuthContext";
import { Dialog } from "../components/Dialog";
import { EmptyTablePlaceholder } from "../components/EmptyTablePlaceholder";
import { useFlash } from "../components/FlashContext";
import { PageChrome } from "../components/PageChrome";
import { TablePagination } from "../components/TablePagination";
import {
  WORKSPACE_POLICIES_CHANGED,
  listGuardrails,
  setGuardrailEnabled,
  type GuardrailPolicy,
} from "../lib/guardrailStorage";
import { NEMO_RAILS_CHANGED, createNeMoRail, deleteNeMoRail, listNeMoRails } from "../lib/nemoRailStorage";
import type { NeMoPlacement } from "../lib/specTypes";
import { usePagination } from "../hooks/usePagination";
import { useRemoteList } from "../lib/useRemoteList";

type GuardrailsTab = "policies" | "rails";

export default function GuardrailsPage() {
  const { user, realmRoles } = useAuth();
  const tabsId = useId();
  const nemoFormId = useId();
  const { showSuccess } = useFlash();
  const username = user?.profile.preferred_username ?? user?.sub ?? "";
  const isAdmin = realmRoles.has("admin") || realmRoles.has("platform-admin");

  const [tab, setTab] = useState<GuardrailsTab>("policies");
  const policies = useRemoteList(WORKSPACE_POLICIES_CHANGED, listGuardrails);
  const policyPage = usePagination(policies, 10);
  const rails = useRemoteList(NEMO_RAILS_CHANGED, listNeMoRails);
  const railsPage = usePagination(rails, 10);

  const [railDialogOpen, setRailDialogOpen] = useState(false);
  const [nName, setNName] = useState("");
  const [nPlacement, setNPlacement] = useState<NeMoPlacement>("generic");
  const [nRaw, setNRaw] = useState("# NeMo Colang / YAML (demo — not executed in browser)\n");
  const [nFormErr, setNFormErr] = useState<string | null>(null);

  const resetRailForm = () => {
    setNName("");
    setNRaw("# NeMo Colang / YAML (demo — not executed in browser)\n");
    setNPlacement("generic");
    setNFormErr(null);
  };

  const closeRailDialog = () => {
    setRailDialogOpen(false);
    resetRailForm();
  };

  const toggle = useCallback(
    async (id: string, enabled: boolean) => {
      await setGuardrailEnabled(id, enabled);
      showSuccess(enabled ? "Policy enabled." : "Policy disabled.");
    },
    [showSuccess],
  );

  const onCreateRail = async (e: FormEvent) => {
    e.preventDefault();
    if (!nName.trim()) {
      setNFormErr("Name is required.");
      return;
    }
    setNFormErr(null);
    await createNeMoRail({
      name: nName.trim(),
      rawConfig: nRaw,
      placement: nPlacement,
      createdBy: username,
    });
    showSuccess("Card rail saved.");
    closeRailDialog();
  };

  const tabBtn = (id: GuardrailsTab, label: string) => (
    <button
      key={id}
      type="button"
      role="tab"
      id={`${tabsId}-${id}`}
      aria-selected={tab === id}
      aria-controls={`${tabsId}-panel-${id}`}
      tabIndex={tab === id ? 0 : -1}
      onClick={() => setTab(id)}
      className={[
        "border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
        tab === id
          ? "border-neutral-900 text-neutral-900"
          : "border-transparent text-neutral-500 hover:text-neutral-800",
      ].join(" ")}
    >
      {label}
    </button>
  );

  return (
    <PageChrome
      title="Guardrails"
      description="Workspace policies are built-in toggles (PII, secrets, toxicity, URLs). Card rails are NeMo-style Colang/YAML configs attached to pipelines — not enforced in the browser."
      actions={
        tab === "rails" ? (
          <button
            type="button"
            onClick={() => {
              resetRailForm();
              setRailDialogOpen(true);
            }}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            New card rail
          </button>
        ) : undefined
      }
    >
      <div className="mt-6 border-b border-neutral-200" role="tablist" aria-label="Guardrails sections">
        <div className="flex flex-wrap gap-1">
          {tabBtn("policies", "Workspace policies")}
          {tabBtn("rails", "Card rails (NeMo)")}
        </div>
      </div>

      <div
        role="tabpanel"
        id={`${tabsId}-panel-policies`}
        aria-labelledby={`${tabsId}-policies`}
        hidden={tab !== "policies"}
        className="mt-6"
      >
        <div className="rounded-lg border border-neutral-200 bg-neutral-50/70 px-4 py-3 text-sm text-neutral-700">
          <p className="font-medium text-neutral-900">Policies in this workspace</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-neutral-600">
            <li>
              <strong>Block PII export</strong> — SSN, card numbers, national IDs in outputs.
            </li>
            <li>
              <strong>No secrets in responses</strong> — API keys and PEM blocks stripped from assistant text.
            </li>
            <li>
              <strong>Toxicity filter (input)</strong> — abusive user turns blocked before the model.
            </li>
            <li>
              <strong>Allowlist outbound URLs</strong> — only approved corporate domains in links (off by default).
            </li>
          </ul>
          <p className="mt-2 text-xs text-neutral-500">
            Toggles below persist in this browser. Runtime enforcement hooks to your execution service later.
          </p>
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border border-neutral-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3">Policy</th>
                <th className="px-4 py-3">Description</th>
                <th className="w-48 min-w-[12rem] px-4 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 bg-white">
              {policies.length === 0 ? (
                <EmptyTablePlaceholder
                  colSpan={3}
                  visual="shield"
                  title="No policies loaded"
                  description="Defaults should appear automatically. Refresh the page if this stays empty."
                />
              ) : (
                policyPage.pageItems.map((p) => (
                  <tr key={p.id} className="hover:bg-neutral-50/80">
                    <td className="px-4 py-3 align-middle">
                      <span className="font-semibold text-neutral-900">{p.name}</span>
                      <code className="mt-1 block text-[11px] text-neutral-500">{p.id}</code>
                    </td>
                    <td className="max-w-md px-4 py-3 align-middle text-neutral-600">{p.description}</td>
                    <td className="px-4 py-3 align-middle">
                      <PolicyToggle
                        checked={p.enabled}
                        onChange={(v) => toggle(p.id, v)}
                        label={`${p.name}: ${p.enabled ? "enabled" : "disabled"}`}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <TablePagination
            label="policies"
            page={policyPage.page}
            totalPages={policyPage.totalPages}
            total={policyPage.total}
            from={policyPage.from}
            to={policyPage.to}
            onPageChange={policyPage.setPage}
          />
        </div>
      </div>

      <div
        role="tabpanel"
        id={`${tabsId}-panel-rails`}
        aria-labelledby={`${tabsId}-rails`}
        hidden={tab !== "rails"}
        className="mt-6"
      >
        <p className="text-sm text-neutral-600">
          Card rails are reusable NeMo Guardrails configs (name, placement hint, raw YAML/Colang). Add one with{" "}
          <strong>New card rail</strong> — the table lists saved configs only (no duplicate editor on this page).
        </p>

        <div className="mt-4 overflow-hidden rounded-lg border border-neutral-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Placement</th>
                <th className="px-4 py-3">Created by</th>
                <th className="w-20 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 bg-white">
              {rails.length === 0 ? (
                <EmptyTablePlaceholder
                  colSpan={4}
                  visual="shield"
                  title="No card rails yet"
                  description="NeMo configs live here. Create one from the dialog — same pattern as retrieval profiles on RAG & ingestion."
                  action={
                    <button
                      type="button"
                      onClick={() => {
                        resetRailForm();
                        setRailDialogOpen(true);
                      }}
                      className="rounded-md bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800"
                    >
                      New card rail
                    </button>
                  }
                />
              ) : (
                railsPage.pageItems.map((r) => (
                  <tr key={r.id} className="hover:bg-neutral-50/80">
                    <td className="px-4 py-3 font-semibold text-neutral-900">{r.name}</td>
                    <td className="px-4 py-3 text-xs text-neutral-600">{r.placement}</td>
                    <td className="px-4 py-3 text-xs text-neutral-600">{r.createdBy}</td>
                    <td className="px-4 py-3 text-xs">
                      {(isAdmin || r.createdBy === username) && (
                        <button
                          type="button"
                          className="text-red-700 underline"
                          onClick={async () => {
                            await deleteNeMoRail(r.id);
                            showSuccess("Card rail removed.");
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <TablePagination
            label="card rails"
            page={railsPage.page}
            totalPages={railsPage.totalPages}
            total={railsPage.total}
            from={railsPage.from}
            to={railsPage.to}
            onPageChange={railsPage.setPage}
          />
        </div>
      </div>

      <Dialog
        open={railDialogOpen}
        onClose={closeRailDialog}
        title="New card rail (NeMo config)"
        description="Colang/YAML is stored for pipeline wiring. Execution still happens server-side."
        size="lg"
      >
        <form onSubmit={onCreateRail} className="space-y-4">
          {nFormErr ? (
            <p className="text-sm text-red-600" role="alert">
              {nFormErr}
            </p>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={`${nemoFormId}-name`} className="block text-sm font-medium text-neutral-700">
                Name <span className="text-red-600">*</span>
              </label>
              <input
                id={`${nemoFormId}-name`}
                value={nName}
                onChange={(e) => {
                  setNName(e.target.value);
                  setNFormErr(null);
                }}
                className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
                placeholder="e.g. Block jailbreak colang"
              />
            </div>
            <div>
              <label htmlFor={`${nemoFormId}-placement`} className="block text-sm font-medium text-neutral-700">
                Default placement
              </label>
              <select
                id={`${nemoFormId}-placement`}
                value={nPlacement}
                onChange={(e) => setNPlacement(e.target.value as NeMoPlacement)}
                className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
              >
                <option value="generic">Generic</option>
                <option value="before_model">Before model</option>
                <option value="after_model">After model</option>
                <option value="after_tool">After tool</option>
              </select>
            </div>
          </div>
          <div>
            <label htmlFor={`${nemoFormId}-raw`} className="block text-sm font-medium text-neutral-700">
              Raw config (YAML / Colang)
            </label>
            <textarea
              id={`${nemoFormId}-raw`}
              value={nRaw}
              onChange={(e) => setNRaw(e.target.value)}
              rows={10}
              className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 font-mono text-xs"
            />
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-neutral-200 pt-4">
            <button type="button" className="rounded-md border border-neutral-300 px-4 py-2 text-sm" onClick={closeRailDialog}>
              Cancel
            </button>
            <button type="submit" className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white">
              Save card rail
            </button>
          </div>
        </form>
      </Dialog>
    </PageChrome>
  );
}

/** Compact switch: w-11 track + w-5 thumb so translate-x-5 lands flush (fixes misaligned “On” / knob). */
function PolicyToggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <div className="flex items-center justify-end gap-3">
      <span
        className={[
          "order-2 min-w-[3.25rem] text-right text-xs font-semibold tabular-nums",
          checked ? "text-emerald-700" : "text-neutral-500",
        ].join(" ")}
      >
        {checked ? "On" : "Off"}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={[
          "order-1 relative h-6 w-11 shrink-0 rounded-full border transition-colors",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2",
          checked ? "border-neutral-900 bg-neutral-900" : "border-neutral-300 bg-neutral-200",
        ].join(" ")}
      >
        <span
          aria-hidden
          className={[
            "pointer-events-none absolute top-0.5 block h-5 w-5 rounded-full bg-white shadow ring-1 ring-black/5 transition-transform duration-200 ease-out",
            checked ? "translate-x-5" : "translate-x-0.5",
          ].join(" ")}
        />
      </button>
    </div>
  );
}
