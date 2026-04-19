import { type FormEvent, useId, useState } from "react";

import { useAuth } from "../auth/AuthContext";
import { Dialog } from "../components/Dialog";
import { EmptyTablePlaceholder } from "../components/EmptyTablePlaceholder";
import { useFlash } from "../components/FlashContext";
import { PageChrome } from "../components/PageChrome";
import { TablePagination } from "../components/TablePagination";
import { usePagination } from "../hooks/usePagination";
import type { McpTransport } from "../lib/specTypes";
import { TOOLS_CHANGED, createTool, deleteTool, listTools } from "../lib/toolStorage";
import { useRemoteList } from "../lib/useRemoteList";

const DEFAULT_MCP_CONFIG = `{
  "url": "https://example.com/mcp"
}`;

function parseMcpConfigJson(raw: string): { ok: true; value: string } | { ok: false; message: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, message: "MCP configuration (JSON) is required." };
  }
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, message: "MCP configuration must be a JSON object (not an array or primitive)." };
    }
    return { ok: true, value: JSON.stringify(parsed, null, 2) };
  } catch {
    return { ok: false, message: "MCP configuration must be valid JSON." };
  }
}

function toolDetailsPreview(t: { description: string; mcpConfigJson: string }): string {
  if (t.description.trim()) return t.description;
  try {
    const o = JSON.parse(t.mcpConfigJson) as Record<string, unknown>;
    const u = o.url ?? o.endpoint ?? o.serverUrl;
    if (typeof u === "string" && u) return u;
  } catch {
    /* ignore */
  }
  return t.mcpConfigJson.slice(0, 80) + (t.mcpConfigJson.length > 80 ? "…" : "");
}

export default function ToolsPage() {
  const { user, realmRoles } = useAuth();
  const formId = useId();
  const { showSuccess } = useFlash();
  const username = user?.profile.preferred_username ?? user?.sub ?? "";
  const isAdmin = realmRoles.has("admin") || realmRoles.has("platform-admin");
  const tools = useRemoteList(TOOLS_CHANGED, listTools);
  const toolsPage = usePagination(tools, 10);

  const [name, setName] = useState("");
  const [formErr, setFormErr] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [mcpTransport, setMcpTransport] = useState<McpTransport>("sse");
  const [mcpConfigJson, setMcpConfigJson] = useState(DEFAULT_MCP_CONFIG);
  const [headersJson, setHeadersJson] = useState("");
  const [registerOpen, setRegisterOpen] = useState(false);

  const resetForm = () => {
    setName("");
    setDescription("");
    setMcpTransport("sse");
    setMcpConfigJson(DEFAULT_MCP_CONFIG);
    setHeadersJson("");
    setFormErr(null);
  };

  const closeRegister = () => {
    setRegisterOpen(false);
    resetForm();
  };

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormErr("Name is required.");
      return;
    }
    const cfg = parseMcpConfigJson(mcpConfigJson);
    if (!cfg.ok) {
      setFormErr(cfg.message);
      return;
    }
    if (headersJson.trim()) {
      try {
        JSON.parse(headersJson);
      } catch {
        setFormErr("Headers must be valid JSON.");
        return;
      }
    }
    setFormErr(null);
    const input = {
      name: name.trim(),
      kind: "mcp" as const,
      description: description.trim(),
      createdBy: username,
      mcpTransport,
      mcpConfigJson: cfg.value,
      headersJson: headersJson.trim() || undefined,
    };
    await createTool(input);
    showSuccess("Tool saved.");
    setRegisterOpen(false);
    resetForm();
  };

  return (
    <PageChrome
      title="Tools"
      description="Register MCP server metadata for agents (SSE or HTTP transport). Definitions are stored in Postgres and used when building agent runs."
      actions={
        <button
          type="button"
          onClick={() => setRegisterOpen(true)}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          Register tool
        </button>
      }
    >
      <Dialog open={registerOpen} onClose={closeRegister} title="Register MCP tool" size="lg">
        <form onSubmit={onCreate} className="max-w-xl space-y-4">
          {formErr ? (
            <p className="text-sm text-red-600" role="alert">
              {formErr}
            </p>
          ) : null}
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
            <label htmlFor={`${formId}-description`} className="block text-sm font-medium text-neutral-700">
              Description
            </label>
            <textarea
              id={`${formId}-description`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor={`${formId}-transport`} className="block text-sm font-medium text-neutral-700">
              Transport
            </label>
            <select
              id={`${formId}-transport`}
              value={mcpTransport}
              onChange={(e) => setMcpTransport(e.target.value as McpTransport)}
              className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
            >
              <option value="sse">SSE</option>
              <option value="http">HTTP</option>
            </select>
            <p className="mt-1 text-xs text-neutral-500">
              Remote MCP via Server-Sent Events or HTTP — stdio/IO are not configured in this UI.
            </p>
          </div>
          <div>
            <label htmlFor={`${formId}-mcp-config`} className="block text-sm font-medium text-neutral-700">
              MCP configuration (JSON)
            </label>
            <p className="mt-1 text-xs text-neutral-600">
              Connection details for your MCP server (for example <code className="rounded bg-neutral-100 px-1">url</code>, auth,
              or provider-specific fields). Must be a single JSON object.
            </p>
            <textarea
              id={`${formId}-mcp-config`}
              value={mcpConfigJson}
              onChange={(e) => {
                setMcpConfigJson(e.target.value);
                setFormErr(null);
              }}
              rows={10}
              spellCheck={false}
              className="mt-2 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 font-mono text-xs leading-relaxed"
            />
          </div>
          <div>
            <label htmlFor={`${formId}-headers`} className="block text-sm font-medium text-neutral-700">
              Headers JSON (optional)
            </label>
            <textarea
              id={`${formId}-headers`}
              value={headersJson}
              onChange={(e) => setHeadersJson(e.target.value)}
              rows={2}
              placeholder='{"Authorization": "Bearer ..."}'
              className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 font-mono text-xs"
            />
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-neutral-200 pt-4">
            <button type="button" className="rounded-md border border-neutral-300 px-4 py-2 text-sm" onClick={closeRegister}>
              Cancel
            </button>
            <button type="submit" className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white">
              Save tool
            </button>
          </div>
        </form>
      </Dialog>

      <div className="mt-10 overflow-hidden rounded-lg border border-neutral-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Transport</th>
              <th className="px-4 py-2">Created by</th>
              <th className="px-4 py-2">Details</th>
              <th className="w-20 px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 bg-white">
            {tools.length === 0 ? (
              <EmptyTablePlaceholder
                colSpan={5}
                title="No tools registered"
                description="Add MCP server metadata (JSON config, SSE or HTTP) for agents and pipelines. Stored in this browser only."
                action={
                  <button
                    type="button"
                    onClick={() => setRegisterOpen(true)}
                    className="rounded-md bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800"
                  >
                    Register a tool
                  </button>
                }
              />
            ) : (
              toolsPage.pageItems.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-2 font-medium">{t.name}</td>
                  <td className="px-4 py-2 uppercase text-neutral-700">{t.mcpTransport}</td>
                  <td className="px-4 py-2 text-neutral-600">{t.createdBy}</td>
                  <td className="max-w-xs truncate px-4 py-2 text-xs text-neutral-600">{toolDetailsPreview(t)}</td>
                  <td className="px-4 py-2">
                    {(isAdmin || t.createdBy === username) && t.createdBy !== "system" ? (
                      <button
                        type="button"
                        className="text-xs text-red-700 underline"
                        onClick={() => {
                          void deleteTool(t.id).then(() => showSuccess("Tool removed."));
                        }}
                      >
                        Delete
                      </button>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <TablePagination
          label="tools"
          page={toolsPage.page}
          totalPages={toolsPage.totalPages}
          total={toolsPage.total}
          from={toolsPage.from}
          to={toolsPage.to}
          onPageChange={toolsPage.setPage}
        />
      </div>
    </PageChrome>
  );
}
