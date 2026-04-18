import { type FormEvent, useCallback, useId, useState } from "react";

import { useAuth } from "../auth/AuthContext";
import { EmptyTablePlaceholder } from "../components/EmptyTablePlaceholder";
import { useFlash } from "../components/FlashContext";
import { PageChrome } from "../components/PageChrome";
import { TablePagination } from "../components/TablePagination";
import { listGuardrails, setGuardrailEnabled, type GuardrailPolicy } from "../lib/guardrailStorage";
import {
  NEMO_RAILS_CHANGED,
  createNeMoRail,
  deleteNeMoRail,
  listNeMoRails,
} from "../lib/nemoRailStorage";
import type { NeMoPlacement } from "../lib/specTypes";
import { usePagination } from "../hooks/usePagination";
import { useSyncedList } from "../lib/useSyncedList";

export default function GuardrailsPage() {
  const { user, realmRoles } = useAuth();
  const nemoFormId = useId();
  const { showSuccess } = useFlash();
  const username = user?.profile.preferred_username ?? user?.sub ?? "";
  const isAdmin = realmRoles.has("admin") || realmRoles.has("platform-admin");
  const [policies, setPolicies] = useState<GuardrailPolicy[]>(() => listGuardrails());
  const policyPage = usePagination(policies, 10);
  const rails = useSyncedList(NEMO_RAILS_CHANGED, listNeMoRails);
  const railsPage = usePagination(rails, 10);

  const [nName, setNName] = useState("");
  const [nPlacement, setNPlacement] = useState<NeMoPlacement>("generic");
  const [nRaw, setNRaw] = useState("# NeMo Colang / YAML (demo — not executed in browser)\n");
  const [nFormErr, setNFormErr] = useState<string | null>(null);

  const toggle = useCallback(
    (id: string, enabled: boolean) => {
      setGuardrailEnabled(id, enabled);
      setPolicies(listGuardrails());
      showSuccess(enabled ? "Policy enabled." : "Policy disabled.");
    },
    [showSuccess],
  );

  const onCreateRail = (e: FormEvent) => {
    e.preventDefault();
    if (!nName.trim()) {
      setNFormErr("Name is required.");
      return;
    }
    setNFormErr(null);
    createNeMoRail({
      name: nName.trim(),
      rawConfig: nRaw,
      placement: nPlacement,
      createdBy: username,
    });
    setNName("");
    setNRaw("# NeMo Colang / YAML (demo — not executed in browser)\n");
    setNPlacement("generic");
    showSuccess("NeMo config saved.");
  };

  return (
    <PageChrome
      title="Guardrails"
      description="Workspace policy toggles and NeMo-style configs for pipelines. Enforcement is not run in the browser — definitions are stored locally."
    >
      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Workspace policies</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Turn policies on or off for this browser session. Use the switch to enable — including PII blocking and toxicity
          filters.
        </p>
        <div className="mt-4 overflow-hidden rounded-lg border border-neutral-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3">Policy</th>
                <th className="px-4 py-3">Description</th>
                <th className="w-44 px-4 py-3 text-right">Status</th>
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
                  <tr key={p.id} className="align-middle hover:bg-neutral-50/80">
                    <td className="px-4 py-3">
                      <span className="font-semibold text-neutral-900">{p.name}</span>
                      <code className="mt-1 block text-[11px] text-neutral-500">{p.id}</code>
                    </td>
                    <td className="max-w-md px-4 py-3 text-neutral-600">{p.description}</td>
                    <td className="px-4 py-3">
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
      </section>

      <section className="mt-12 border-t border-neutral-200 pt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">NeMo Guardrails configs</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Save Colang/YAML blobs for use in pipeline steps. Placement hints help when wiring LangGraph later.
        </p>

        <form onSubmit={onCreateRail} className="mt-6 space-y-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          {nFormErr ? (
            <p className="text-sm text-red-600" role="alert">
              {nFormErr}
            </p>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={`${nemoFormId}-name`} className="block text-sm font-medium text-neutral-700">
                Name
              </label>
              <input
                id={`${nemoFormId}-name`}
                value={nName}
                onChange={(e) => {
                  setNName(e.target.value);
                  setNFormErr(null);
                }}
                className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
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
              rows={8}
              className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 font-mono text-xs"
            />
          </div>
          <button type="submit" className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white">
            Save NeMo config
          </button>
        </form>

        <div className="mt-8 overflow-hidden rounded-lg border border-neutral-200">
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
                  title="No NeMo configs yet"
                  description="Add a name and raw YAML above. Saved configs appear here with pagination."
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
                          onClick={() => {
                            deleteNeMoRail(r.id, username, isAdmin);
                            showSuccess("NeMo config removed.");
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
            label="NeMo configs"
            page={railsPage.page}
            totalPages={railsPage.totalPages}
            total={railsPage.total}
            from={railsPage.from}
            to={railsPage.to}
            onPageChange={railsPage.setPage}
          />
        </div>
      </section>
    </PageChrome>
  );
}

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
          "min-w-[2rem] text-right text-xs font-semibold tabular-nums",
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
          "relative h-8 w-14 shrink-0 rounded-full border-2 transition-colors",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2",
          checked ? "border-neutral-900 bg-neutral-900" : "border-neutral-300 bg-neutral-100",
        ].join(" ")}
      >
        <span
          className={[
            "absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-md ring-1 ring-black/5 transition-transform",
            checked ? "translate-x-6" : "translate-x-0.5",
          ].join(" ")}
        />
      </button>
    </div>
  );
}
