import { type DragEvent, useCallback, useEffect, useId, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { PageChrome } from "../components/PageChrome";
import { useFlash } from "../components/FlashContext";
import { AGENT_SPECS_CHANGED, listAgentSpecs } from "../lib/agentSpecStorage";
import { useSyncedList } from "../lib/useSyncedList";
import { notifyWorkflowCatalogChanged, workflowById } from "../lib/workflowCatalog";
import {
  DND_AGENT_ID,
  DND_STEP_FROM_INDEX,
  isCustomWorkflow,
  makeWorkflowFlowStep,
  updateCustomWorkflow,
  type WorkflowFlowStep,
} from "../lib/workflowStorage";

function parseNullableNumber(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export default function WorkflowEditorPage() {
  const { workflowId } = useParams<{ workflowId: string }>();
  const { user, realmRoles } = useAuth();
  const { showSuccess } = useFlash();
  const agents = useSyncedList(AGENT_SPECS_CHANGED, listAgentSpecs);
  const formPrefix = useId();

  const wf = workflowById(workflowId);
  const username = user?.profile.preferred_username ?? user?.sub ?? "";
  const isAdmin = realmRoles.has("admin") || realmRoles.has("platform-admin");
  const custom = wf && isCustomWorkflow(wf) ? wf : null;
  const isSystem = Boolean(wf && !custom);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState<WorkflowFlowStep[]>([]);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const touchDirty = useCallback(() => {
    if (custom) setDirty(true);
  }, [custom]);

  useEffect(() => {
    const w = workflowById(workflowId);
    if (!w) return;
    setName(w.name);
    setDescription(w.description);
    setSteps(isCustomWorkflow(w) ? w.flowSteps : []);
    setSelectedStepId(null);
    setDirty(false);
  }, [workflowId]);

  const selectedStep = useMemo(
    () => steps.find((s) => s.id === selectedStepId) ?? null,
    [steps, selectedStepId],
  );

  const agentById = useMemo(() => {
    const m = new Map(agents.map((a) => [a.id, a]));
    return (id: string) => m.get(id);
  }, [agents]);

  const onDragOverAllowDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    const types = Array.from(e.dataTransfer.types);
    e.dataTransfer.dropEffect = types.includes(DND_STEP_FROM_INDEX) ? "move" : "copy";
  }, []);

  const onDropStepReorder = useCallback((targetIndex: number, e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const agentId = e.dataTransfer.getData(DND_AGENT_ID);
    if (agentId) {
      setSteps((prev) => {
        const next = [...prev];
        next.splice(targetIndex, 0, makeWorkflowFlowStep(agentId));
        return next;
      });
      touchDirty();
      return;
    }
    const fromStr = e.dataTransfer.getData(DND_STEP_FROM_INDEX);
    if (fromStr === "") return;
    const from = Number.parseInt(fromStr, 10);
    setSteps((prev) => {
      if (Number.isNaN(from) || from < 0 || from >= prev.length) return prev;
      if (from === targetIndex) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      let insert = targetIndex;
      if (from < targetIndex) insert = targetIndex - 1;
      next.splice(insert, 0, moved);
      return next;
    });
    touchDirty();
  }, [custom, touchDirty]);

  const onDropAppend = useCallback((e: DragEvent) => {
    e.preventDefault();
    const agentId = e.dataTransfer.getData(DND_AGENT_ID);
    if (agentId) {
      setSteps((prev) => [...prev, makeWorkflowFlowStep(agentId)]);
      touchDirty();
      return;
    }
    const fromStr = e.dataTransfer.getData(DND_STEP_FROM_INDEX);
    if (fromStr === "") return;
    const from = Number.parseInt(fromStr, 10);
    setSteps((prev) => {
      if (Number.isNaN(from) || from < 0 || from >= prev.length) return prev;
      if (from === prev.length - 1) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.push(moved);
      return next;
    });
    touchDirty();
  }, [custom, touchDirty]);

  const removeStep = (id: string) => {
    setSteps((prev) => prev.filter((s) => s.id !== id));
    setSelectedStepId((cur) => (cur === id ? null : cur));
    touchDirty();
  };

  const patchSelectedStep = (patch: Partial<WorkflowFlowStep>) => {
    if (!selectedStepId) return;
    setSteps((prev) => prev.map((s) => (s.id === selectedStepId ? { ...s, ...patch } : s)));
    touchDirty();
  };

  const onSave = () => {
    if (!custom || !workflowId) return;
    const ok = updateCustomWorkflow(
      workflowId,
      {
        name: name.trim() || "Untitled workflow",
        description: description.trim(),
        flowSteps: steps,
      },
      username,
      isAdmin,
    );
    if (ok) {
      notifyWorkflowCatalogChanged();
      setDirty(false);
      showSuccess("Workflow saved.");
    }
  };

  if (!workflowId || !wf) {
    return <Navigate to="/workflows" replace />;
  }

  return (
    <PageChrome title="Workflow editor" showTitle={false}>
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <header className="shrink-0 border-b border-neutral-200 pb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <Link
                to="/workflows"
                className="text-sm font-medium text-neutral-600 underline-offset-4 hover:text-neutral-900 hover:underline"
              >
                ← Workflow catalog
              </Link>
              <div className="mt-3">
                <label htmlFor={`${formPrefix}-name`} className="sr-only">
                  Workflow name
                </label>
                <input
                  id={`${formPrefix}-name`}
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    touchDirty();
                  }}
                  disabled={isSystem}
                  className="w-full max-w-xl border-0 border-b border-transparent bg-transparent p-0 text-2xl font-semibold tracking-tight text-neutral-900 outline-none focus:border-neutral-300 disabled:cursor-not-allowed disabled:opacity-80"
                  placeholder="Workflow name"
                />
              </div>
              <label htmlFor={`${formPrefix}-desc`} className="mt-3 block text-xs font-medium uppercase tracking-wide text-neutral-500">
                Description
              </label>
              <textarea
                id={`${formPrefix}-desc`}
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  touchDirty();
                }}
                disabled={isSystem}
                rows={2}
                className="mt-1 w-full max-w-2xl resize-y rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 disabled:bg-neutral-50"
              />
            </div>
            {custom ? (
              <button
                type="button"
                onClick={onSave}
                disabled={!dirty}
                className="shrink-0 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-40"
              >
                Save workflow
              </button>
            ) : null}
          </div>
          {isSystem ? (
            <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              Built-in template — you can try the canvas here, but changes are not saved. Create a workflow from the
              catalog to persist an agent sequence.
            </p>
          ) : null}
        </header>

        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(200px,240px)_1fr_minmax(240px,300px)] lg:gap-0 lg:divide-x lg:divide-neutral-200">
          {/* Agents */}
          <section className="flex min-h-0 min-h-[200px] flex-col lg:min-h-[420px] lg:pr-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Agents</h2>
            <p className="mt-1 text-xs text-neutral-500">Drag an agent into the flow. You can use the same agent more than once.</p>
            <ul className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain">
              {agents.length === 0 ? (
                <li className="rounded-md border border-dashed border-neutral-300 p-3 text-sm text-neutral-600">
                  No agents yet. Add agents under <Link className="font-medium underline" to="/agents">Agents</Link>.
                </li>
              ) : (
                agents.map((a) => (
                  <li key={a.id}>
                    <div
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData(DND_AGENT_ID, a.id);
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      className={[
                        "cursor-grab rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm shadow-sm active:cursor-grabbing",
                        a.status === "paused" ? "opacity-80" : "",
                      ].join(" ")}
                    >
                      <span className="font-medium text-neutral-900">{a.name}</span>
                      <span className="mt-0.5 block text-xs text-neutral-500">{a.model}</span>
                      {a.status === "paused" ? (
                        <span className="mt-1 inline-block text-[10px] font-semibold uppercase text-amber-800">Paused</span>
                      ) : null}
                    </div>
                  </li>
                ))
              )}
            </ul>
          </section>

          {/* Canvas */}
          <section
            className="flex min-h-[280px] min-w-0 flex-col lg:px-4"
            onDragOver={onDragOverAllowDrop}
            onDrop={onDropAppend}
          >
            <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Flow</h2>
            <p className="mt-1 text-xs text-neutral-500">
              Drop agents to build the sequence. Drag the grip on a step to reorder. Select a step to edit parameters.
            </p>
            <div className="mt-3 flex min-h-0 flex-1 flex-col rounded-lg border border-dashed border-neutral-300 bg-neutral-50/50 p-3">
              {steps.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 py-12 text-center text-sm text-neutral-500">
                  <p>Drag agents here from the left.</p>
                </div>
              ) : (
                <ol className="space-y-2">
                  {steps.map((s, i) => {
                    const ag = agentById(s.agentId);
                    const selected = s.id === selectedStepId;
                    return (
                      <li
                        key={s.id}
                        onDragOver={onDragOverAllowDrop}
                        onDrop={(e) => onDropStepReorder(i, e)}
                        className="flex items-stretch gap-2"
                      >
                        <button
                          type="button"
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData(DND_STEP_FROM_INDEX, String(i));
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          className="flex w-8 shrink-0 cursor-grab items-center justify-center rounded border border-neutral-200 bg-white text-neutral-400 hover:bg-neutral-100 active:cursor-grabbing"
                          aria-label={`Reorder step ${i + 1}`}
                          title="Drag to reorder"
                        >
                          ⋮⋮
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedStepId(s.id)}
                          className={[
                            "min-w-0 flex-1 rounded-lg border px-3 py-2.5 text-left text-sm transition",
                            selected
                              ? "border-neutral-900 bg-white ring-1 ring-neutral-900"
                              : "border-neutral-200 bg-white hover:border-neutral-400",
                          ].join(" ")}
                        >
                          <span className="text-xs font-semibold text-neutral-500">Step {i + 1}</span>
                          <div className="mt-0.5 font-medium text-neutral-900">{ag?.name ?? "Unknown agent"}</div>
                          <div className="mt-0.5 text-xs text-neutral-500">
                            {s.modelOverride.trim() ? s.modelOverride : ag?.model ?? "—"}
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => removeStep(s.id)}
                          className="shrink-0 self-start rounded px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                        >
                          Remove
                        </button>
                      </li>
                    );
                  })}
                </ol>
              )}
              {steps.length > 0 ? (
                <div
                  onDragOver={onDragOverAllowDrop}
                  onDrop={onDropAppend}
                  className="mt-3 rounded-md border border-dashed border-neutral-300 py-4 text-center text-xs text-neutral-500"
                >
                  Drop here to append to the end
                </div>
              ) : null}
            </div>
          </section>

          {/* Inspector */}
          <section className="flex min-h-0 flex-col lg:pl-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Step settings</h2>
            {!selectedStep ? (
              <p className="mt-3 text-sm text-neutral-600">Select a step in the flow to override model and sampling parameters for that node.</p>
            ) : (
              <div className="mt-3 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1 text-sm">
                {(() => {
                  const ag = agentById(selectedStep.agentId);
                  return (
                    <>
                      <div className="rounded-md border border-neutral-200 bg-white p-3">
                        <p className="text-xs font-semibold uppercase text-neutral-500">Agent</p>
                        <p className="mt-1 font-medium text-neutral-900">{ag?.name ?? "Unknown"}</p>
                        <p className="mt-0.5 text-xs text-neutral-500">Base model: {ag?.model ?? "—"}</p>
                      </div>
                      <div>
                        <label htmlFor={`${formPrefix}-model`} className="block text-xs font-medium text-neutral-700">
                          Model override
                        </label>
                        <input
                          id={`${formPrefix}-model`}
                          value={selectedStep.modelOverride}
                          onChange={(e) => patchSelectedStep({ modelOverride: e.target.value })}
                          disabled={isSystem}
                          placeholder={ag?.model ?? "e.g. gpt-4o-mini"}
                          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:bg-neutral-50"
                        />
                        <p className="mt-1 text-xs text-neutral-500">Leave empty to use the agent&apos;s model.</p>
                      </div>
                      <div>
                        <label htmlFor={`${formPrefix}-temp`} className="block text-xs font-medium text-neutral-700">
                          Temperature
                        </label>
                        <input
                          id={`${formPrefix}-temp`}
                          type="text"
                          inputMode="decimal"
                          value={selectedStep.temperature === null ? "" : String(selectedStep.temperature)}
                          onChange={(e) => patchSelectedStep({ temperature: parseNullableNumber(e.target.value) })}
                          disabled={isSystem}
                          placeholder="Default"
                          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:bg-neutral-50"
                        />
                      </div>
                      <div>
                        <label htmlFor={`${formPrefix}-topp`} className="block text-xs font-medium text-neutral-700">
                          Top P
                        </label>
                        <input
                          id={`${formPrefix}-topp`}
                          type="text"
                          inputMode="decimal"
                          value={selectedStep.topP === null ? "" : String(selectedStep.topP)}
                          onChange={(e) => patchSelectedStep({ topP: parseNullableNumber(e.target.value) })}
                          disabled={isSystem}
                          placeholder="Default"
                          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:bg-neutral-50"
                        />
                      </div>
                      <div>
                        <label htmlFor={`${formPrefix}-topk`} className="block text-xs font-medium text-neutral-700">
                          Top K
                        </label>
                        <input
                          id={`${formPrefix}-topk`}
                          type="text"
                          inputMode="numeric"
                          value={selectedStep.topK === null ? "" : String(selectedStep.topK)}
                          onChange={(e) => {
                            const v = parseNullableNumber(e.target.value);
                            patchSelectedStep({ topK: v === null ? null : Math.round(v) });
                          }}
                          disabled={isSystem}
                          placeholder="Default"
                          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:bg-neutral-50"
                        />
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </section>
        </div>
      </div>
    </PageChrome>
  );
}
