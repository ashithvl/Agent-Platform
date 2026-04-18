import { type FormEvent, useCallback, useId, useState } from "react";

import { useAuth } from "../auth/AuthContext";
import { useFlash } from "../components/FlashContext";
import { PageChrome } from "../components/PageChrome";
import { listGuardrails, setGuardrailEnabled, type GuardrailPolicy } from "../lib/guardrailStorage";
import {
  NEMO_RAILS_CHANGED,
  createNeMoRail,
  deleteNeMoRail,
  listNeMoRails,
} from "../lib/nemoRailStorage";
import type { NeMoPlacement } from "../lib/specTypes";
import { useSyncedList } from "../lib/useSyncedList";

export default function GuardrailsPage() {
  const { user, realmRoles } = useAuth();
  const nemoFormId = useId();
  const { showSuccess } = useFlash();
  const username = user?.profile.preferred_username ?? user?.sub ?? "";
  const isAdmin = realmRoles.has("admin") || realmRoles.has("platform-admin");
  const [policies, setPolicies] = useState<GuardrailPolicy[]>(() => listGuardrails());
  const rails = useSyncedList(NEMO_RAILS_CHANGED, listNeMoRails);

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
      description="Quick policy toggles plus NeMo Guardrails config blobs for pipelines. Enforcement requires a future NeMo runtime — this page only stores definitions locally."
    >
      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Workspace policies</h2>
        <ul className="mt-4 space-y-3">
          {policies.map((p) => (
            <li
              key={p.id}
              className="flex items-start justify-between gap-4 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm"
            >
              <div>
                <h3 className="font-semibold text-neutral-900">{p.name}</h3>
                <p className="mt-1 text-sm text-neutral-600">{p.description}</p>
                <code className="mt-2 inline-block text-xs text-neutral-500">{p.id}</code>
              </div>
              <Toggle checked={p.enabled} onChange={(v) => toggle(p.id, v)} />
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12 border-t border-neutral-200 pt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">NeMo Guardrails configs</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Attach these in workflow pipelines (before/after steps). Placement is a UX hint for LangGraph wiring later.
        </p>

        <form onSubmit={onCreateRail} className="mt-6 space-y-4 rounded-lg border border-neutral-200 bg-neutral-50/50 p-4">
          {nFormErr ? (
            <p className="text-sm text-red-600" role="alert">
              {nFormErr}
            </p>
          ) : null}
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
              className="mt-1 w-full max-w-md rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor={`${nemoFormId}-placement`} className="block text-sm font-medium text-neutral-700">
              Default placement hint
            </label>
            <select
              id={`${nemoFormId}-placement`}
              value={nPlacement}
              onChange={(e) => setNPlacement(e.target.value as NeMoPlacement)}
              className="mt-1 w-full max-w-md rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
            >
              <option value="generic">Generic</option>
              <option value="before_model">Before model</option>
              <option value="after_model">After model</option>
              <option value="after_tool">After tool</option>
            </select>
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
          <button type="submit" className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white">
            Save NeMo config
          </button>
        </form>

        <ul className="mt-6 space-y-2">
          {rails.map((r) => (
            <li key={r.id} className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-neutral-200 bg-white p-3 text-sm">
              <div>
                <span className="font-semibold">{r.name}</span>
                <span className="ml-2 text-xs text-neutral-500">{r.placement}</span>
                <p className="text-xs text-neutral-500">by {r.createdBy}</p>
              </div>
              {(isAdmin || r.createdBy === username) && (
                <button
                  type="button"
                  className="text-xs text-red-700 underline"
                  onClick={() => {
                    deleteNeMoRail(r.id, username, isAdmin);
                    showSuccess("NeMo config removed.");
                  }}
                >
                  Delete
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </PageChrome>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={[
        "relative h-7 w-12 shrink-0 rounded-full transition-colors",
        checked ? "bg-neutral-900" : "bg-neutral-300",
      ].join(" ")}
    >
      <span
        className={[
          "absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-5" : "translate-x-0.5",
        ].join(" ")}
      />
    </button>
  );
}
