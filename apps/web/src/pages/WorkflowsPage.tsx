import { type FormEvent, type ReactNode, useState } from "react";

import { useAuth } from "../auth/AuthContext";
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
import { createWorkflow, deleteCustomWorkflow, isCustomWorkflow } from "../lib/workflowStorage";
import { notifyWorkflowCatalogChanged } from "../lib/workflowCatalog";
import { useWorkflowCatalog } from "../lib/useWorkflowCatalog";
import { useSyncedList } from "../lib/useSyncedList";

type Tab = "runtime" | "pipelines";

export default function WorkflowsPage() {
  const [tab, setTab] = useState<Tab>("runtime");
  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <header className="border-b border-neutral-200 pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Workflows</h1>
        <p className="mt-1 text-sm text-neutral-600">
          <strong>Runtime &amp; API</strong> flows power Chat and API keys. <strong>Pipelines</strong> are sequential
          LangGraph-style configs (agent → RAG → …) with optional NeMo guard slots — saved locally only.
        </p>
        <div className="mt-4 flex gap-2 border-b border-neutral-200">
          <TabBtn active={tab === "runtime"} onClick={() => setTab("runtime")}>
            Runtime &amp; API
          </TabBtn>
          <TabBtn active={tab === "pipelines"} onClick={() => setTab("pipelines")}>
            Pipelines
          </TabBtn>
        </div>
      </header>

      {tab === "runtime" ? <RuntimeWorkflowsTab /> : <PipelinesTab />}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "-mb-px border-b-2 px-4 py-2 text-sm font-medium",
        active ? "border-neutral-900 text-neutral-900" : "border-transparent text-neutral-500 hover:text-neutral-800",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function RuntimeWorkflowsTab() {
  const { user, realmRoles } = useAuth();
  const workflows = useWorkflowCatalog();
  const username = user?.profile.preferred_username ?? user?.sub ?? "";
  const isAdmin = realmRoles.has("admin") || realmRoles.has("platform-admin");
  const canSeeApiKeys =
    realmRoles.has("api_access") || realmRoles.has("admin") || realmRoles.has("platform-admin");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [err, setErr] = useState<string | null>(null);

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
    }
  };

  return (
    <>
      <section className="mt-10 rounded-lg border border-neutral-200 bg-neutral-50/50 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Create runtime flow</h2>
        <form onSubmit={onCreate} className="mt-4 grid max-w-xl gap-4 sm:grid-cols-1">
          <div>
            <label className="block text-sm font-medium text-neutral-700">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
          </div>
          {err ? (
            <p className="text-sm text-red-600" role="alert">
              {err}
            </p>
          ) : null}
          <button
            type="submit"
            className="w-fit rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            Create flow
          </button>
        </form>
      </section>

      <ul className="mt-10 space-y-3">
        {workflows.map((w) => {
          const custom = isCustomWorkflow(w);
          return (
            <li key={w.id} className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-neutral-900">{w.name}</h2>
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
                </div>
                <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
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
  const username = user?.profile.preferred_username ?? user?.sub ?? "";
  const isAdmin = realmRoles.has("admin") || realmRoles.has("platform-admin");
  const pipelines = useSyncedList(PIPELINES_CHANGED, listPipelines);
  const agents = useSyncedList(AGENT_SPECS_CHANGED, listAgentSpecs);
  const rags = useSyncedList(RAG_PROFILES_CHANGED, listRagProfiles);
  const rails = useSyncedList(NEMO_RAILS_CHANGED, listNeMoRails);

  const [pName, setPName] = useState("");
  const [pDesc, setPDesc] = useState("");
  const [steps, setSteps] = useState<PipelineStep[]>([]);

  const addAgentStep = () => {
    const aid = agents[0]?.id ?? "";
    if (!aid) return;
    setSteps((s) => [...s, { type: "agent", agentId: aid }]);
  };
  const addRagStep = () => {
    const rid = rags[0]?.id ?? "";
    if (!rid) return;
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
    if (!pName.trim() || steps.length === 0) return;
    createPipeline({ name: pName, description: pDesc, steps, createdBy: username });
    setPName("");
    setPDesc("");
    setSteps([]);
  };

  return (
    <>
      <section className="mt-10 rounded-lg border border-neutral-200 bg-neutral-50/50 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">New sequential pipeline</h2>
        <form onSubmit={onSavePipeline} className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-neutral-700">Pipeline name</label>
              <input
                value={pName}
                onChange={(e) => setPName(e.target.value)}
                className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700">Description</label>
              <input
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
                    <select
                      value={st.agentId}
                      onChange={(e) =>
                        updateStep(i, {
                          type: "agent",
                          agentId: e.target.value,
                          guardBeforeId: st.guardBeforeId,
                          guardAfterId: st.guardAfterId,
                        })
                      }
                      className="mt-2 w-full max-w-md rounded border px-2 py-1 text-sm"
                    >
                      {agents.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <select
                      value={st.ragProfileId}
                      onChange={(e) =>
                        updateStep(i, {
                          type: "rag",
                          ragProfileId: e.target.value,
                          guardBeforeId: st.guardBeforeId,
                          guardAfterId: st.guardAfterId,
                        })
                      }
                      className="mt-2 w-full max-w-md rounded border px-2 py-1 text-sm"
                    >
                      {rags.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  )}
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <label className="text-xs text-neutral-600">
                      Guard before (NeMo)
                      <select
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
                    </label>
                    <label className="text-xs text-neutral-600">
                      Guard after (NeMo)
                      <select
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
                    </label>
                  </div>
                </li>
              ))}
            </ol>
            {steps.length === 0 ? <p className="mt-2 text-sm text-neutral-500">Add at least one step.</p> : null}
          </div>
          <button type="submit" className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white">
            Save pipeline
          </button>
        </form>
      </section>

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
                    onClick={() => deletePipeline(p.id, username, isAdmin)}
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
