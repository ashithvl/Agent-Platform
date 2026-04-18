import { type FormEvent, type KeyboardEvent, useId, useRef, useState } from "react";

import { useAuth } from "../auth/AuthContext";
import { Dialog } from "../components/Dialog";
import { useFlash } from "../components/FlashContext";
import { PageChrome } from "../components/PageChrome";
import type { WorkflowDef } from "../data/workflows";
import { AGENT_SPECS_CHANGED, listAgentSpecs } from "../lib/agentSpecStorage";
import { NEMO_RAILS_CHANGED, listNeMoRails } from "../lib/nemoRailStorage";
import {
  PIPELINES_CHANGED,
  createPipeline,
  deletePipeline,
  listPipelines,
} from "../lib/pipelineGraphStorage";
import { RAG_PROFILES_CHANGED, listRagProfiles } from "../lib/ragProfileStorage";
import type { PipelineStep } from "../lib/specTypes";
import { createWorkflow, deleteCustomWorkflow, isCustomWorkflow, type CustomWorkflow } from "../lib/workflowStorage";
import { notifyWorkflowCatalogChanged } from "../lib/workflowCatalog";
import { useWorkflowCatalog } from "../lib/useWorkflowCatalog";
import { useSyncedList } from "../lib/useSyncedList";

type Tab = "runtime" | "pipelines";

export default function WorkflowsPage() {
  const [tab, setTab] = useState<Tab>("runtime");
  const tabsBaseId = useId();
  const runtimeTabId = `${tabsBaseId}-tab-runtime`;
  const pipelinesTabId = `${tabsBaseId}-tab-pipelines`;
  const runtimePanelId = `${tabsBaseId}-panel-runtime`;
  const pipelinesPanelId = `${tabsBaseId}-panel-pipelines`;
  const runtimeTabRef = useRef<HTMLButtonElement>(null);
  const pipelinesTabRef = useRef<HTMLButtonElement>(null);

  const focusTab = (next: Tab) => {
    setTab(next);
    (next === "runtime" ? runtimeTabRef : pipelinesTabRef).current?.focus();
  };

  const onTabKeyDown = (e: KeyboardEvent, current: Tab) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      focusTab(current === "runtime" ? "pipelines" : "runtime");
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      focusTab(current === "pipelines" ? "runtime" : "pipelines");
    } else if (e.key === "Home") {
      e.preventDefault();
      focusTab("runtime");
    } else if (e.key === "End") {
      e.preventDefault();
      focusTab("pipelines");
    }
  };

  return (
    <PageChrome showTitle={false}>
      <header className="border-b border-neutral-200 pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Workflows</h1>
        <p className="mt-1 text-sm text-neutral-600">
          <strong>Runtime &amp; API</strong> flows power Chat and API keys. <strong>Pipelines</strong> are sequential
          LangGraph-style configs (agent → RAG → …) with optional NeMo guard slots — saved locally only.
        </p>
        <div role="tablist" aria-label="Workflow configuration" className="mt-4 flex gap-2 border-b border-neutral-200">
          <button
            ref={runtimeTabRef}
            type="button"
            role="tab"
            id={runtimeTabId}
            aria-selected={tab === "runtime"}
            aria-controls={runtimePanelId}
            tabIndex={tab === "runtime" ? 0 : -1}
            onClick={() => setTab("runtime")}
            onKeyDown={(e) => onTabKeyDown(e, "runtime")}
            className={[
              "-mb-px border-b-2 px-4 py-2 text-sm font-medium",
              tab === "runtime"
                ? "border-neutral-900 text-neutral-900"
                : "border-transparent text-neutral-500 hover:text-neutral-800",
            ].join(" ")}
          >
            Runtime &amp; API
          </button>
          <button
            ref={pipelinesTabRef}
            type="button"
            role="tab"
            id={pipelinesTabId}
            aria-selected={tab === "pipelines"}
            aria-controls={pipelinesPanelId}
            tabIndex={tab === "pipelines" ? 0 : -1}
            onClick={() => setTab("pipelines")}
            onKeyDown={(e) => onTabKeyDown(e, "pipelines")}
            className={[
              "-mb-px border-b-2 px-4 py-2 text-sm font-medium",
              tab === "pipelines"
                ? "border-neutral-900 text-neutral-900"
                : "border-transparent text-neutral-500 hover:text-neutral-800",
            ].join(" ")}
          >
            Pipelines
          </button>
        </div>
      </header>

      <div
        role="tabpanel"
        id={runtimePanelId}
        aria-labelledby={runtimeTabId}
        hidden={tab !== "runtime"}
        tabIndex={-1}
        className="outline-none"
      >
        <RuntimeWorkflowsTab />
      </div>
      <div
        role="tabpanel"
        id={pipelinesPanelId}
        aria-labelledby={pipelinesTabId}
        hidden={tab !== "pipelines"}
        tabIndex={-1}
        className="outline-none"
      >
        <PipelinesTab />
      </div>
    </PageChrome>
  );
}

type CatalogWf = WorkflowDef | CustomWorkflow;

function RuntimeWorkflowsTab() {
  const { user, realmRoles } = useAuth();
  const { showSuccess } = useFlash();
  const formId = useId();
  const workflows = useWorkflowCatalog();
  const username = user?.profile.preferred_username ?? user?.sub ?? "";
  const isAdmin = realmRoles.has("admin") || realmRoles.has("platform-admin");
  const canSeeApiKeys =
    realmRoles.has("api_access") || realmRoles.has("admin") || realmRoles.has("platform-admin");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [inspect, setInspect] = useState<CatalogWf | null>(null);

  const onCreate = (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!name.trim()) {
      setErr("Name is required.");
      return;
    }
    createWorkflow(username, name, description);
    setName("");
    setDescription("");
    notifyWorkflowCatalogChanged();
    showSuccess("Workflow created.");
    setCreateOpen(false);
  };

  const onDelete = (id: string) => {
    if (
      !window.confirm(
        canSeeApiKeys
          ? "Remove this workflow? API keys for this id will stop resolving under API access."
          : "Remove this workflow? It will disappear from Chat and the catalog.",
      )
    )
      return;
    if (deleteCustomWorkflow(id, username, isAdmin)) {
      notifyWorkflowCatalogChanged();
      showSuccess("Workflow removed.");
    }
    if (inspect?.id === id) setInspect(null);
  };

  const closeCreate = () => {
    setCreateOpen(false);
    setErr(null);
    setName("");
    setDescription("");
  };

  return (
    <>
      <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Runtime &amp; API flows</h2>
        <button
          type="button"
          onClick={() => {
            setErr(null);
            setCreateOpen(true);
          }}
          className="w-fit rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          Create runtime flow
        </button>
      </div>

      <Dialog open={createOpen} onClose={closeCreate} title="Create runtime flow" description="Adds a workflow to Chat and the catalog.">
        <form onSubmit={onCreate} className="grid gap-4">
          <div>
            <label htmlFor={`${formId}-name`} className="block text-sm font-medium text-neutral-700">
              Name
            </label>
            <input
              id={`${formId}-name`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor={`${formId}-description`} className="block text-sm font-medium text-neutral-700">
              Description
            </label>
            <textarea
              id={`${formId}-description`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
            />
          </div>
          {err ? (
            <p className="text-sm text-red-600" role="alert">
              {err}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
            >
              Create flow
            </button>
            <button type="button" className="rounded-md border border-neutral-300 px-4 py-2 text-sm" onClick={closeCreate}>
              Cancel
            </button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={inspect !== null}
        onClose={() => setInspect(null)}
        title={inspect?.name ?? "Workflow"}
        description="Use this id in API access keys and when selecting a workflow in Chat."
        size="lg"
      >
        {inspect ? (
          <div className="space-y-3 text-sm">
            <p>
              <span className="font-medium text-neutral-800">Id</span>{" "}
              <code className="rounded bg-neutral-100 px-2 py-0.5 text-xs">{inspect.id}</code>
            </p>
            <p className="text-neutral-700">{inspect.description}</p>
            {isCustomWorkflow(inspect) ? (
              <p className="text-xs text-neutral-500">Custom flow · created by {inspect.createdBy}</p>
            ) : (
              <p className="text-xs text-neutral-500">System-provided template.</p>
            )}
          </div>
        ) : null}
      </Dialog>

      <ul className="mt-6 space-y-3">
        {workflows.map((w) => {
          const custom = isCustomWorkflow(w);
          return (
            <li key={w.id} className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-stretch">
                <button
                  type="button"
                  onClick={() => setInspect(w)}
                  className="min-w-0 flex-1 p-4 text-left transition hover:bg-neutral-50/80"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-neutral-900">{w.name}</span>
                    {custom ? (
                      <span className="rounded border border-neutral-900 bg-neutral-900 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                        Yours
                      </span>
                    ) : (
                      <span className="rounded border border-neutral-300 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
                        System
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-neutral-600">{w.description}</p>
                  {custom ? <p className="mt-1 text-xs text-neutral-500">Created by {w.createdBy}</p> : null}
                  <p className="mt-2 text-xs font-medium text-neutral-500">Open for full details and workflow id →</p>
                </button>
                <div className="flex shrink-0 flex-col justify-center gap-2 border-t border-neutral-200 bg-neutral-50/80 px-4 py-3 sm:border-l sm:border-t-0 sm:items-end">
                  <code className="rounded bg-neutral-100 px-2 py-1 text-xs text-neutral-800">{w.id}</code>
                  {custom && (isAdmin || w.createdBy === username) ? (
                    <button
                      type="button"
                      onClick={() => onDelete(w.id)}
                      className="text-xs font-medium text-red-700 underline"
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function PipelinesTab() {
  const { user, realmRoles } = useAuth();
  const { showSuccess } = useFlash();
  const formId = useId();
  const username = user?.profile.preferred_username ?? user?.sub ?? "";
  const isAdmin = realmRoles.has("admin") || realmRoles.has("platform-admin");
  const pipelines = useSyncedList(PIPELINES_CHANGED, listPipelines);
  const agents = useSyncedList(AGENT_SPECS_CHANGED, listAgentSpecs);
  const rags = useSyncedList(RAG_PROFILES_CHANGED, listRagProfiles);
  const rails = useSyncedList(NEMO_RAILS_CHANGED, listNeMoRails);

  const [pName, setPName] = useState("");
  const [pDesc, setPDesc] = useState("");
  const [steps, setSteps] = useState<PipelineStep[]>([]);
  const [pipelineErr, setPipelineErr] = useState<string | null>(null);
  const [newPipelineOpen, setNewPipelineOpen] = useState(false);

  const resetPipelineForm = () => {
    setPName("");
    setPDesc("");
    setSteps([]);
    setPipelineErr(null);
  };

  const closePipelineDialog = () => {
    setNewPipelineOpen(false);
    resetPipelineForm();
  };

  const addAgentStep = () => {
    const aid = agents[0]?.id ?? "";
    if (!aid) return;
    setPipelineErr(null);
    setSteps((s) => [...s, { type: "agent", agentId: aid }]);
  };
  const addRagStep = () => {
    const rid = rags[0]?.id ?? "";
    if (!rid) return;
    setPipelineErr(null);
    setSteps((s) => [...s, { type: "rag", ragProfileId: rid }]);
  };
  const removeStep = (i: number) => setSteps((s) => s.filter((_, j) => j !== i));
  const updateStep = (i: number, patch: Partial<PipelineStep>) => {
    setSteps((s) =>
      s.map((st, j) => {
        if (j !== i) return st;
        return { ...st, ...patch } as PipelineStep;
      }),
    );
  };

  const onSavePipeline = (e: FormEvent) => {
    e.preventDefault();
    if (!pName.trim()) {
      setPipelineErr("Pipeline name is required.");
      return;
    }
    if (steps.length === 0) {
      setPipelineErr("Add at least one step before saving.");
      return;
    }
    setPipelineErr(null);
    createPipeline({ name: pName, description: pDesc, steps, createdBy: username });
    resetPipelineForm();
    showSuccess("Pipeline saved.");
    setNewPipelineOpen(false);
  };

  return (
    <>
      <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Sequential pipelines</h2>
        <button
          type="button"
          onClick={() => setNewPipelineOpen(true)}
          className="w-fit rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          New pipeline
        </button>
      </div>

      <Dialog
        open={newPipelineOpen}
        onClose={closePipelineDialog}
        title="New sequential pipeline"
        description="Agent and RAG steps with optional NeMo guard slots — saved in this browser only."
        size="xl"
      >
        <form onSubmit={onSavePipeline} className="space-y-4">
          {pipelineErr ? (
            <p className="text-sm text-red-600" role="alert">
              {pipelineErr}
            </p>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={`${formId}-pname`} className="block text-sm font-medium text-neutral-700">
                Pipeline name
              </label>
              <input
                id={`${formId}-pname`}
                value={pName}
                onChange={(e) => {
                  setPName(e.target.value);
                  setPipelineErr(null);
                }}
                className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor={`${formId}-pdesc`} className="block text-sm font-medium text-neutral-700">
                Description
              </label>
              <input
                id={`${formId}-pdesc`}
                value={pDesc}
                onChange={(e) => setPDesc(e.target.value)}
                className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="rounded border px-3 py-1 text-sm" onClick={addAgentStep}>
                + Agent step
              </button>
              <button type="button" className="rounded border px-3 py-1 text-sm" onClick={addRagStep}>
                + RAG step
              </button>
            </div>
            <ol className="mt-4 space-y-3">
              {steps.map((st, i) => (
                <li key={i} className="rounded-md border border-neutral-200 bg-white p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      {i + 1}. {st.type === "agent" ? "Agent" : "RAG"}
                    </span>
                    <button type="button" className="text-xs text-red-700 underline" onClick={() => removeStep(i)}>
                      Remove
                    </button>
                  </div>
                  {st.type === "agent" ? (
                    <>
                      <label htmlFor={`${formId}-step-${i}-agent`} className="mt-2 block text-xs text-neutral-600">
                        Agent
                      </label>
                      <select
                        id={`${formId}-step-${i}-agent`}
                        value={st.agentId}
                        onChange={(e) =>
                          updateStep(i, {
                            type: "agent",
                            agentId: e.target.value,
                            guardBeforeId: st.guardBeforeId,
                            guardAfterId: st.guardAfterId,
                          })
                        }
                        className="mt-1 w-full max-w-md rounded border px-2 py-1 text-sm"
                      >
                        {agents.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </>
                  ) : (
                    <>
                      <label htmlFor={`${formId}-step-${i}-rag`} className="mt-2 block text-xs text-neutral-600">
                        RAG profile
                      </label>
                      <select
                        id={`${formId}-step-${i}-rag`}
                        value={st.ragProfileId}
                        onChange={(e) =>
                          updateStep(i, {
                            type: "rag",
                            ragProfileId: e.target.value,
                            guardBeforeId: st.guardBeforeId,
                            guardAfterId: st.guardAfterId,
                          })
                        }
                        className="mt-1 w-full max-w-md rounded border px-2 py-1 text-sm"
                      >
                        {rags.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </>
                  )}
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <div>
                      <label htmlFor={`${formId}-step-${i}-gb`} className="block text-xs text-neutral-600">
                        Guard before (NeMo)
                      </label>
                      <select
                        id={`${formId}-step-${i}-gb`}
                        value={st.guardBeforeId ?? ""}
                        onChange={(e) => updateStep(i, { guardBeforeId: e.target.value || undefined })}
                        className="mt-1 block w-full rounded border px-2 py-1 text-sm"
                      >
                        <option value="">—</option>
                        {rails.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor={`${formId}-step-${i}-ga`} className="block text-xs text-neutral-600">
                        Guard after (NeMo)
                      </label>
                      <select
                        id={`${formId}-step-${i}-ga`}
                        value={st.guardAfterId ?? ""}
                        onChange={(e) => updateStep(i, { guardAfterId: e.target.value || undefined })}
                        className="mt-1 block w-full rounded border px-2 py-1 text-sm"
                      >
                        <option value="">—</option>
                        {rails.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
            {steps.length === 0 ? <p className="mt-2 text-sm text-neutral-500">Add at least one step.</p> : null}
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <button type="submit" className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white">
              Save pipeline
            </button>
            <button type="button" className="rounded-md border border-neutral-300 px-4 py-2 text-sm" onClick={closePipelineDialog}>
              Cancel
            </button>
          </div>
        </form>
      </Dialog>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Saved pipelines</h2>
        <ul className="mt-4 space-y-2">
          {pipelines.map((p) => (
            <li key={p.id} className="rounded-lg border border-neutral-200 bg-white p-4 text-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <span className="font-semibold">{p.name}</span>
                  <p className="text-xs text-neutral-600">{p.description}</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {p.steps.length} step(s) · by {p.createdBy}
                  </p>
                </div>
                {(isAdmin || p.createdBy === username) && (
                  <button
                    type="button"
                    className="text-xs text-red-700 underline"
                    onClick={() => {
                      deletePipeline(p.id, username, isAdmin);
                      showSuccess("Pipeline removed.");
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
