import { type FormEvent, useState } from "react";

import { useAuth } from "../auth/AuthContext";
import { TOOLS_CHANGED, createTool, deleteTool, listTools, type ToolKind } from "../lib/toolStorage";
import { useSyncedList } from "../lib/useSyncedList";

export default function ToolsPage() {
  const { user, realmRoles } = useAuth();
  const username = user?.profile.preferred_username ?? user?.sub ?? "";
  const isAdmin = realmRoles.has("admin") || realmRoles.has("platform-admin");
  const tools = useSyncedList(TOOLS_CHANGED, listTools);

  const [name, setName] = useState("");
  const [kind, setKind] = useState<ToolKind>("mcp");
  const [description, setDescription] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [transport, setTransport] = useState("stdio");
  const [headersJson, setHeadersJson] = useState("");

  const onCreate = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
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
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <header className="border-b border-neutral-200 pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Tools</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Global tool registry (MCP-style metadata). Execution is not wired in the browser — configs are for a future
          LangChain / worker runtime.
        </p>
      </header>

      <section className="mt-10 rounded-lg border border-neutral-200 bg-neutral-50/50 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Register tool</h2>
        <form onSubmit={onCreate} className="mt-4 max-w-xl space-y-3">
          <div>
            <label className="block text-sm font-medium text-neutral-700">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700">Kind</label>
            <select
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
            <label className="block text-sm font-medium text-neutral-700">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
            />
          </div>
          {kind === "mcp" ? (
            <>
              <div>
                <label className="block text-sm font-medium text-neutral-700">MCP server URL</label>
                <input
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  placeholder="https://mcp.example.com/sse"
                  className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700">Transport</label>
                <input
                  value={transport}
                  onChange={(e) => setTransport(e.target.value)}
                  className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700">Headers JSON (optional)</label>
                <textarea
                  value={headersJson}
                  onChange={(e) => setHeadersJson(e.target.value)}
                  rows={2}
                  placeholder='{"Authorization": "Bearer ..."}'
                  className="mt-1 w-full font-mono text-xs"
                />
              </div>
            </>
          ) : null}
          <button type="submit" className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white">
            Save tool
          </button>
        </form>
      </section>

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
                      onClick={() => deleteTool(t.id, username, isAdmin)}
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
    </div>
  );
}
