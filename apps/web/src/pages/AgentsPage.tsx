import { type FormEvent, useId, useMemo, useState } from "react";

import { useAuth } from "../auth/AuthContext";
import { Dialog } from "../components/Dialog";
import { EmptyTablePlaceholder } from "../components/EmptyTablePlaceholder";
import { useFlash } from "../components/FlashContext";
import { PageChrome } from "../components/PageChrome";
import { TablePagination } from "../components/TablePagination";
import { usePagination } from "../hooks/usePagination";
import {
  AGENT_SPECS_CHANGED,
  createAgentSpec,
  deleteAgentSpec,
  listAgentSpecs,
  updateAgentSpec,
} from "../lib/agentSpecStorage";
import { filterLLMModelsForAgent } from "../lib/liteLLMModels";
import type { AgentSpec } from "../lib/specTypes";
import { TOOLS_CHANGED, listTools } from "../lib/toolStorage";
import { useLiteLLMModels } from "../lib/useLiteLLMModels";
import { useSyncedList } from "../lib/useSyncedList";

const VAR_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

function formatContextSummary(a: AgentSpec): string {
  if (a.contextVariableNames.length === 0) return "—";
  return a.contextVariableNames.join(", ");
}

export default function AgentsPage() {
  const { user, realmRoles } = useAuth();
  const formId = useId();
  const { showSuccess } = useFlash();
  const username = user?.profile.preferred_username ?? user?.sub ?? "";
  const isAdmin = realmRoles.has("admin") || realmRoles.has("platform-admin");
  const agents = useSyncedList(AGENT_SPECS_CHANGED, listAgentSpecs);
  const tools = useSyncedList(TOOLS_CHANGED, listTools);
  const { models } = useLiteLLMModels();
  const agentPage = usePagination(agents, 10);

  const [editing, setEditing] = useState<AgentSpec | null>(null);
  const [creating, setCreating] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [onlyMultiModel, setOnlyMultiModel] = useState(false);
  const [toolSelectKey, setToolSelectKey] = useState(0);

  const [name, setName] = useState("");
  const [model, setModel] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [contextVariableNames, setContextVariableNames] = useState<string[]>([""]);
  const [toolIds, setToolIds] = useState<string[]>([]);
  const [status, setStatus] = useState<"active" | "paused">("active");

  const modelOptions = useMemo(() => filterLLMModelsForAgent(models, onlyMultiModel), [models, onlyMultiModel]);

  const loadForm = (a: AgentSpec | null) => {
    setOnlyMultiModel(false);
    if (!a) {
      setName("");
      setModel("");
      setSystemPrompt("");
      setContextVariableNames([""]);
      setToolIds([]);
      setStatus("active");
      return;
    }
    setName(a.name);
    setModel(a.model);
    setSystemPrompt(a.systemPrompt);
    setContextVariableNames(a.contextVariableNames.length ? [...a.contextVariableNames] : [""]);
    setToolIds(a.toolIds);
    setStatus(a.status);
  };

  const openCreate = () => {
    setEditing(null);
    setCreating(true);
    setFormErr(null);
    loadForm(null);
    const first = filterLLMModelsForAgent(models, false)[0]?.id ?? "";
    setModel(first);
  };

  const openEdit = (a: AgentSpec) => {
    setCreating(false);
    setEditing(a);
    setFormErr(null);
    loadForm(a);
  };

  const setModelScope = (multi: boolean) => {
    setOnlyMultiModel(multi);
    const next = filterLLMModelsForAgent(models, multi);
    setModel((cur) => (next.some((m) => m.id === cur) ? cur : next[0]?.id ?? ""));
  };

  const addContextVarRow = () => setContextVariableNames((prev) => [...prev, ""]);

  const updateContextVarRow = (idx: number, value: string) => {
    setContextVariableNames((prev) => prev.map((v, i) => (i === idx ? value : v)));
  };

  const removeContextVarRow = (idx: number) => {
    setContextVariableNames((prev) => (prev.length <= 1 ? [""] : prev.filter((_, i) => i !== idx)));
  };

  const addToolFromSelect = (id: string) => {
    if (!id || toolIds.includes(id)) return;
    setToolIds((prev) => [...prev, id]);
    setToolSelectKey((k) => k + 1);
  };

  const removeTool = (id: string) => setToolIds((prev) => prev.filter((x) => x !== id));

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormErr("Name is required.");
      return;
    }
    const vars = contextVariableNames.map((s) => s.trim()).filter(Boolean);
    for (const v of vars) {
      if (!VAR_NAME_RE.test(v)) {
        setFormErr(
          `Invalid context variable “${v}”. Use letters, numbers, and underscores; start with a letter or _.`,
        );
        return;
      }
    }
    if (!model.trim()) {
      setFormErr(
        modelOptions.length === 0
          ? onlyMultiModel
            ? "No multi-model LLMs in the catalog. Turn off “Multi-model only” or add models in liteLLMModels.ts."
            : "No LLM models in the bundled catalog."
          : "Select a model.",
      );
      return;
    }
    setFormErr(null);
    const uniqueVars = [...new Set(vars)];
    if (editing) {
      updateAgentSpec(editing.id, username, isAdmin, {
        name,
        model,
        systemPrompt,
        contextVariableNames: uniqueVars,
        toolIds,
        status,
      });
      setEditing(null);
      showSuccess("Agent updated.");
    } else {
      createAgentSpec({
        name,
        model,
        systemPrompt,
        contextVariableNames: uniqueVars,
        toolIds,
        createdBy: username,
        status,
      });
      setCreating(false);
      showSuccess("Agent created.");
    }
    setName("");
    setSystemPrompt("");
    setContextVariableNames([""]);
    setToolIds([]);
    setStatus("active");
    setModel(filterLLMModelsForAgent(models, false)[0]?.id ?? "");
    setOnlyMultiModel(false);
  };

  const onDelete = (a: AgentSpec) => {
    if (!window.confirm(`Delete agent “${a.name}”?`)) return;
    deleteAgentSpec(a.id, username, isAdmin);
    if (editing?.id === a.id) {
      setEditing(null);
      setCreating(false);
    }
    showSuccess("Agent removed.");
  };

  const closeForm = () => {
    setCreating(false);
    setEditing(null);
    setFormErr(null);
  };

  const formOpen = creating || editing !== null;

  const toolsById = useMemo(() => new Map(tools.map((t) => [t.id, t])), [tools]);
  const availableToolsToAdd = tools.filter((t) => !toolIds.includes(t.id));

  return (
    <PageChrome
      title="Agents"
      description="Define the LLM, system prompt, context variable names your callers will fill, and tools. Stored in this browser; execution is not connected."
      actions={
        <button type="button" onClick={openCreate} className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white">
          New agent
        </button>
      }
    >
      <Dialog
        open={formOpen}
        onClose={closeForm}
        title={editing ? "Edit agent" : "Create agent"}
        size="xl"
      >
        <form onSubmit={onSubmit} className="space-y-4">
          {formErr ? (
            <p className="text-sm text-red-600" role="alert">
              {formErr}
            </p>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={`${formId}-name`} className="block text-sm font-medium text-neutral-700">
                Name
              </label>
              <input
                id={`${formId}-name`}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setFormErr(null);
                }}
                className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <span className="block text-sm font-medium text-neutral-700">LLM model</span>
              <p className="mt-1 text-xs text-neutral-500">Chat models only — embedding and rerank models are excluded.</p>
              <fieldset className="mt-2 space-y-2 border-0 p-0">
                <legend className="sr-only">Model catalog scope</legend>
                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name={`${formId}-model-scope`}
                      checked={!onlyMultiModel}
                      onChange={() => setModelScope(false)}
                    />
                    <span>All LLM models</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name={`${formId}-model-scope`}
                      checked={onlyMultiModel}
                      onChange={() => setModelScope(true)}
                    />
                    <span>Multi-model only</span>
                  </label>
                </div>
              </fieldset>
              <label htmlFor={`${formId}-model`} className="sr-only">
                Model
              </label>
              <select
                id={`${formId}-model`}
                value={model}
                onChange={(e) => {
                  setModel(e.target.value);
                  setFormErr(null);
                }}
                className="mt-2 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
              >
                {model && !modelOptions.some((m) => m.id === model) ? (
                  <option value={model}>{model} (current value)</option>
                ) : null}
                {modelOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
              {modelOptions.length === 0 ? (
                <p className="mt-1 text-xs text-amber-800">
                  No models match this filter — adjust multi-model or add LLM entries in liteLLMModels.ts.
                </p>
              ) : null}
            </div>
          </div>
          <div>
            <label htmlFor={`${formId}-system`} className="block text-sm font-medium text-neutral-700">
              System prompt
            </label>
            <textarea
              id={`${formId}-system`}
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={5}
              className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 font-mono text-xs"
            />
          </div>

          <fieldset className="min-w-0 border-0 p-0">
            <legend className="block text-sm font-medium text-neutral-700">Context variables</legend>
            <p className="mt-1 text-xs text-neutral-600">
              Names of slots your app passes at runtime (e.g. <code className="rounded bg-neutral-100 px-1">user_id</code>,{" "}
              <code className="rounded bg-neutral-100 px-1">rag_context</code>). Use letters, numbers, and underscores;
              start with a letter or underscore.
            </p>
            <ul className="mt-3 space-y-2">
              {contextVariableNames.map((row, idx) => (
                <li key={idx} className="flex gap-2">
                  <label htmlFor={`${formId}-ctx-${idx}`} className="sr-only">
                    Variable {idx + 1}
                  </label>
                  <input
                    id={`${formId}-ctx-${idx}`}
                    value={row}
                    onChange={(e) => updateContextVarRow(idx, e.target.value)}
                    placeholder="e.g. session_id"
                    className="min-w-0 flex-1 rounded-md border border-neutral-300 bg-white px-3 py-2 font-mono text-sm"
                  />
                  <button
                    type="button"
                    className="shrink-0 rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                    onClick={() => removeContextVarRow(idx)}
                    aria-label={`Remove variable ${idx + 1}`}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="mt-2 text-sm font-medium text-neutral-800 underline-offset-4 hover:underline"
              onClick={addContextVarRow}
            >
              + Add variable
            </button>
          </fieldset>

          <div>
            <label htmlFor={`${formId}-add-tool`} className="block text-sm font-medium text-neutral-700">
              Tools
            </label>
            <select
              key={toolSelectKey}
              id={`${formId}-add-tool`}
              defaultValue=""
              onChange={(e) => {
                addToolFromSelect(e.target.value);
                e.target.value = "";
              }}
              className="mt-1 w-full max-w-md rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">Add a tool…</option>
              {availableToolsToAdd.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} (MCP · {t.mcpTransport.toUpperCase()})
                </option>
              ))}
            </select>
            {tools.length === 0 ? (
              <p className="mt-2 text-xs text-neutral-500">No tools registered yet — add some under Tools.</p>
            ) : null}
            {toolIds.length > 0 ? (
              <ul className="mt-3 divide-y divide-neutral-200 rounded-md border border-neutral-200 bg-neutral-50/80">
                {toolIds.map((id) => {
                  const t = toolsById.get(id);
                  return (
                    <li key={id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                      <span className="min-w-0 truncate">
                        <span className="font-medium text-neutral-900">{t?.name ?? id}</span>{" "}
                        {t ? <span className="text-xs text-neutral-500">(MCP · {t.mcpTransport.toUpperCase()})</span> : null}
                      </span>
                      <button
                        type="button"
                        className="shrink-0 text-xs font-medium text-red-700 underline"
                        onClick={() => removeTool(id)}
                      >
                        Remove
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-neutral-500">No tools attached — optional.</p>
            )}
          </div>

          <div>
            <label htmlFor={`${formId}-status`} className="block text-sm font-medium text-neutral-700">
              Status
            </label>
            <select
              id={`${formId}-status`}
              value={status}
              onChange={(e) => setStatus(e.target.value as "active" | "paused")}
              className="mt-1 w-full max-w-xs rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
            >
              <option value="active">active</option>
              <option value="paused">paused</option>
            </select>
          </div>

          <div className="flex flex-wrap justify-end gap-2 border-t border-neutral-200 pt-4">
            <button type="button" className="rounded-md border border-neutral-300 px-4 py-2 text-sm" onClick={closeForm}>
              Cancel
            </button>
            <button type="submit" className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white">
              Save
            </button>
          </div>
        </form>
      </Dialog>

      <div className="mt-8 overflow-hidden rounded-lg border border-neutral-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Model</th>
              <th className="px-4 py-3">Context variables</th>
              <th className="px-4 py-3">Tools</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Owner</th>
              <th className="w-28 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 bg-white">
            {agents.length === 0 ? (
              <EmptyTablePlaceholder
                colSpan={7}
                visual="activity"
                title="No agents yet"
                description="Agents define the LLM, prompt, context variable names, and tools. Create one to use in pipelines — everything stays in this browser."
                action={
                  <button
                    type="button"
                    onClick={openCreate}
                    className="rounded-md bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800"
                  >
                    Create your first agent
                  </button>
                }
              />
            ) : (
              agentPage.pageItems.map((a) => (
                <tr key={a.id} className="hover:bg-neutral-50/80">
                  <td className="px-4 py-3 font-medium text-neutral-900">{a.name}</td>
                  <td className="px-4 py-3 text-neutral-700">{a.model}</td>
                  <td className="max-w-[220px] px-4 py-3 text-xs text-neutral-600">
                    <span className="line-clamp-2" title={formatContextSummary(a)}>
                      {formatContextSummary(a)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-neutral-600">{a.toolIds.length}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full border border-neutral-300 px-2 py-0.5 text-xs">{a.status}</span>
                  </td>
                  <td className="px-4 py-3 text-xs">{a.createdBy}</td>
                  <td className="px-4 py-3 text-xs">
                    <button type="button" className="mr-2 underline" onClick={() => openEdit(a)}>
                      Edit
                    </button>
                    {a.createdBy !== "system" && (isAdmin || a.createdBy === username) ? (
                      <button type="button" className="text-red-700 underline" onClick={() => onDelete(a)}>
                        Delete
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <TablePagination
          label="agents"
          page={agentPage.page}
          totalPages={agentPage.totalPages}
          total={agentPage.total}
          from={agentPage.from}
          to={agentPage.to}
          onPageChange={agentPage.setPage}
        />
      </div>
    </PageChrome>
  );
}
