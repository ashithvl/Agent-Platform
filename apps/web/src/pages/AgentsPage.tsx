import { type FormEvent, useId, useState } from "react";

import { useAuth } from "../auth/AuthContext";
import { Dialog } from "../components/Dialog";
import { useFlash } from "../components/FlashContext";
import { PageChrome } from "../components/PageChrome";
import {
  AGENT_SPECS_CHANGED,
  createAgentSpec,
  deleteAgentSpec,
  listAgentSpecs,
  updateAgentSpec,
} from "../lib/agentSpecStorage";
import type { AgentSpec, ContextStrategy } from "../lib/specTypes";
import { TOOLS_CHANGED, listTools } from "../lib/toolStorage";
import { useLiteLLMModels } from "../lib/useLiteLLMModels";
import { useSyncedList } from "../lib/useSyncedList";

export default function AgentsPage() {
  const { user, realmRoles } = useAuth();
  const formId = useId();
  const { showSuccess } = useFlash();
  const username = user?.profile.preferred_username ?? user?.sub ?? "";
  const isAdmin = realmRoles.has("admin") || realmRoles.has("platform-admin");
  const agents = useSyncedList(AGENT_SPECS_CHANGED, listAgentSpecs);
  const tools = useSyncedList(TOOLS_CHANGED, listTools);
  const { models } = useLiteLLMModels();

  const [editing, setEditing] = useState<AgentSpec | null>(null);
  const [creating, setCreating] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [model, setModel] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [contextStrategy, setContextStrategy] = useState<ContextStrategy>("passthrough");
  const [contextNotes, setContextNotes] = useState("");
  const [toolIds, setToolIds] = useState<string[]>([]);
  const [status, setStatus] = useState<"active" | "paused">("active");

  const loadForm = (a: AgentSpec | null) => {
    if (!a) {
      setName("");
      setModel(models[0]?.id ?? "");
      setSystemPrompt("");
      setContextStrategy("passthrough");
      setContextNotes("");
      setToolIds([]);
      setStatus("active");
      return;
    }
    setName(a.name);
    setModel(a.model);
    setSystemPrompt(a.systemPrompt);
    setContextStrategy(a.contextStrategy);
    setContextNotes(a.contextNotes);
    setToolIds(a.toolIds);
    setStatus(a.status);
  };

  const openCreate = () => {
    setEditing(null);
    setCreating(true);
    setFormErr(null);
    loadForm(null);
    if (models[0]) setModel(models[0].id);
  };

  const openEdit = (a: AgentSpec) => {
    setCreating(false);
    setEditing(a);
    setFormErr(null);
    loadForm(a);
  };

  const toggleTool = (id: string) => {
    setToolIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormErr("Name is required.");
      return;
    }
    if (!model.trim()) {
      setFormErr(
        models.length === 0 ? "No models in the bundled catalog." : "Select a model.",
      );
      return;
    }
    setFormErr(null);
    if (editing) {
      updateAgentSpec(editing.id, username, isAdmin, {
        name,
        model,
        systemPrompt,
        contextStrategy,
        contextNotes,
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
        contextStrategy,
        contextNotes,
        toolIds,
        createdBy: username,
        status,
      });
      setCreating(false);
      showSuccess("Agent created.");
    }
    setName("");
    setSystemPrompt("");
    setContextStrategy("passthrough");
    setContextNotes("");
    setToolIds([]);
    setStatus("active");
    setModel(models[0]?.id ?? "");
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

  return (
    <PageChrome
      title="Agents"
      description="LangChain-oriented definitions (model, system prompt, context strategy, tools). Stored in the browser; execution is not connected."
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
              <label htmlFor={`${formId}-model`} className="block text-sm font-medium text-neutral-700">
                Model (bundled catalog)
              </label>
              <select
                id={`${formId}-model`}
                value={model}
                onChange={(e) => {
                  setModel(e.target.value);
                  setFormErr(null);
                }}
                className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
              {models.length === 0 ? (
                <p className="mt-1 text-xs text-amber-800">Bundled model list is empty — add entries in liteLLMModels.ts.</p>
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
              className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-mono text-xs"
            />
          </div>
          <div>
            <label htmlFor={`${formId}-ctx-strategy`} className="block text-sm font-medium text-neutral-700">
              Context strategy
            </label>
            <select
              id={`${formId}-ctx-strategy`}
              value={contextStrategy}
              onChange={(e) => setContextStrategy(e.target.value as ContextStrategy)}
              className="mt-1 w-full max-w-md rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
            >
              <option value="passthrough">Passthrough</option>
              <option value="templated">Templated</option>
              <option value="from_previous_step">Inject from previous step</option>
            </select>
          </div>
          <div>
            <label htmlFor={`${formId}-ctx-notes`} className="block text-sm font-medium text-neutral-700">
              Context notes
            </label>
            <textarea
              id={`${formId}-ctx-notes`}
              value={contextNotes}
              onChange={(e) => setContextNotes(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
            />
          </div>
          <fieldset className="min-w-0 border-0 p-0">
            <legend className="block text-sm font-medium text-neutral-700">Tools</legend>
            <ul className="mt-2 space-y-1 text-sm">
              {tools.map((t) => (
                <li key={t.id}>
                  <label htmlFor={`${formId}-tool-${t.id}`} className="flex items-center gap-2">
                    <input
                      id={`${formId}-tool-${t.id}`}
                      type="checkbox"
                      checked={toolIds.includes(t.id)}
                      onChange={() => toggleTool(t.id)}
                    />
                    {t.name} <span className="text-xs text-neutral-500">({t.kind})</span>
                  </label>
                </li>
              ))}
              {tools.length === 0 ? <li className="text-neutral-500">No tools yet — register under Tools.</li> : null}
            </ul>
          </fieldset>
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
          <div className="flex gap-2">
            <button type="submit" className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white">
              Save
            </button>
            <button type="button" className="rounded-md border border-neutral-300 px-4 py-2 text-sm" onClick={closeForm}>
              Cancel
            </button>
          </div>
        </form>
      </Dialog>

      {agents.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-neutral-300 bg-neutral-50/80 px-6 py-12 text-center">
          <p className="text-sm font-semibold text-neutral-900">No agents yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-neutral-600">
            Agents define model, system prompt, tools, and context for your workspace. Create one to use in pipelines
            and future runs — everything is stored in this browser.
          </p>
          <button
            type="button"
            onClick={openCreate}
            className="mt-6 rounded-md bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800"
          >
            Create your first agent
          </button>
        </div>
      ) : (
        <div className="mt-8 overflow-hidden rounded-lg border border-neutral-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Model</th>
                <th className="px-4 py-3">Context</th>
                <th className="px-4 py-3">Tools</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3 w-28" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 bg-white">
              {agents.map((a) => (
                <tr key={a.id} className="hover:bg-neutral-50/80">
                  <td className="px-4 py-3 font-medium text-neutral-900">{a.name}</td>
                  <td className="px-4 py-3 text-neutral-700">{a.model}</td>
                  <td className="px-4 py-3 text-xs text-neutral-600">{a.contextStrategy}</td>
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageChrome>
  );
}
