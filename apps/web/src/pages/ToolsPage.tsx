import { type FormEvent, useId, useState } from "react";

import { useAuth } from "../auth/AuthContext";
import { Dialog } from "../components/Dialog";
import { useFlash } from "../components/FlashContext";
import { PageChrome } from "../components/PageChrome";
import { TOOLS_CHANGED, createTool, deleteTool, listTools, type ToolKind } from "../lib/toolStorage";
import { useSyncedList } from "../lib/useSyncedList";

export default function ToolsPage() {
  const { user, realmRoles } = useAuth();
  const formId = useId();
  const { showSuccess } = useFlash();
  const username = user?.profile.preferred_username ?? user?.sub ?? "";
  const isAdmin = realmRoles.has("admin") || realmRoles.has("platform-admin");
  const tools = useSyncedList(TOOLS_CHANGED, listTools);

  const [name, setName] = useState("");
  const [formErr, setFormErr] = useState<string | null>(null);
  const [kind, setKind] = useState<ToolKind>("mcp");
  const [description, setDescription] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [transport, setTransport] = useState("stdio");
  const [headersJson, setHeadersJson] = useState("");
  const [registerOpen, setRegisterOpen] = useState(false);

  const resetForm = () => {
    setName("");
    setDescription("");
    setServerUrl("");
    setHeadersJson("");
    setKind("mcp");
    setTransport("stdio");
    setFormErr(null);
  };

  const closeRegister = () => {
    setRegisterOpen(false);
    resetForm();
  };

  const onCreate = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormErr("Name is required.");
      return;
    }
    setFormErr(null);
    createTool({
      name: name.trim(),
      kind,
      description: description.trim(),
      createdBy: username,
      serverUrl: kind === "mcp" ? serverUrl.trim() : undefined,
      transport: kind === "mcp" ? transport : undefined,
      headersJson: headersJson.trim() || undefined,
    });
    setName("");
    setDescription("");
    setServerUrl("");
    setHeadersJson("");
    showSuccess("Tool saved.");
    setRegisterOpen(false);
  };

  return (
    <PageChrome
      title="Tools"
      description="Global tool registry (MCP-style metadata). Stored in the browser only — no remote tool execution."
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
      <Dialog open={registerOpen} onClose={closeRegister} title="Register tool" size="lg">
        <form onSubmit={onCreate} className="max-w-xl space-y-3">
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
            <label htmlFor={`${formId}-kind`} className="block text-sm font-medium text-neutral-700">
              Kind
            </label>
            <select
              id={`${formId}-kind`}
              value={kind}
              onChange={(e) => setKind(e.target.value as ToolKind)}
              className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
            >
              <option value="mcp">MCP</option>
              <option value="http">HTTP</option>
              <option value="simple">Simple</option>
            </select>
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
          {kind === "mcp" ? (
            <>
              <div>
                <label htmlFor={`${formId}-server-url`} className="block text-sm font-medium text-neutral-700">
                  MCP server URL
                </label>
                <input
                  id={`${formId}-server-url`}
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  placeholder="https://mcp.example.com/sse"
                  className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor={`${formId}-transport`} className="block text-sm font-medium text-neutral-700">
                  Transport
                </label>
                <input
                  id={`${formId}-transport`}
                  value={transport}
                  onChange={(e) => setTransport(e.target.value)}
                  className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
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
            </>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-2">
            <button type="submit" className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white">
              Save tool
            </button>
            <button type="button" className="rounded-md border border-neutral-300 px-4 py-2 text-sm" onClick={closeRegister}>
              Cancel
            </button>
          </div>
        </form>
      </Dialog>

      <div className="mt-10 overflow-hidden rounded-lg border border-neutral-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Kind</th>
              <th className="px-4 py-2">Created by</th>
              <th className="px-4 py-2">Details</th>
              <th className="px-4 py-2 w-20" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 bg-white">
            {tools.map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-2 font-medium">{t.name}</td>
                <td className="px-4 py-2">{t.kind}</td>
                <td className="px-4 py-2 text-neutral-600">{t.createdBy}</td>
                <td className="max-w-xs truncate px-4 py-2 text-xs text-neutral-600">{t.description || t.serverUrl || "—"}</td>
                <td className="px-4 py-2">
                  {(isAdmin || t.createdBy === username) && t.createdBy !== "system" ? (
                    <button
                      type="button"
                      className="text-xs text-red-700 underline"
                      onClick={() => {
                        deleteTool(t.id, username, isAdmin);
                        showSuccess("Tool removed.");
                      }}
                    >
                      Delete
                    </button>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageChrome>
  );
}
