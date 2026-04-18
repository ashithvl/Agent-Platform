import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "../auth/AuthContext";
import {
  audienceLabel,
  createKnowledgeItem,
  deleteKnowledgeItem,
  type HubAudience,
  type KnowledgeItem,
  updateKnowledgeAudiences,
  updateKnowledgeItem,
} from "../lib/knowledgeStorage";
import { useKnowledgeList } from "../lib/useKnowledge";

const AUDIENCES: HubAudience[] = ["end_user", "developer", "admin"];

export default function KnowledgeHubPage() {
  const { user, realmRoles } = useAuth();
  const items = useKnowledgeList();
  const username = user?.profile.preferred_username ?? user?.sub ?? "";
  const isAdmin = realmRoles.has("admin") || realmRoles.has("platform-admin");

  const visible = useMemo(() => {
    if (isAdmin) return items;
    return items.filter((i) => i.ownerUsername === username || i.audiences.includes("developer"));
  }, [items, isAdmin, username]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [newAudiences, setNewAudiences] = useState<HubAudience[]>(["developer"]);
  const [approvalLines, setApprovalLines] = useState<string[]>([""]);
  const [formErr, setFormErr] = useState<string | null>(null);

  const toggleNewAudience = (a: HubAudience) => {
    setNewAudiences((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  };

  const onCreate = (e: FormEvent) => {
    e.preventDefault();
    setFormErr(null);
    const approvals = approvalLines.map((s) => s.trim()).filter(Boolean);
    if (!title.trim()) {
      setFormErr("Title is required.");
      return;
    }
    if (newAudiences.length === 0) {
      setFormErr("Select at least one audience.");
      return;
    }
    createKnowledgeItem({
      ownerUsername: username,
      title,
      description,
      audiences: newAudiences,
      approvals: approvals.length ? approvals : ["Draft approval"],
    });
    setTitle("");
    setDescription("");
    setNewAudiences(["developer"]);
    setApprovalLines([""]);
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <header className="border-b border-neutral-200 pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Knowledge hub</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Multiple knowledge items per person; each item can carry many approvals. Admins see every hub and which user
          group it serves. Developers manage their own hubs and anything shared with the developer cohort.
        </p>
      </header>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          {isAdmin ? "All knowledge items" : "Your hubs & developer-scoped content"}
        </h2>
        <div className="mt-4 overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-neutral-50 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-2">Title</th>
                <th className="px-4 py-2">Owner</th>
                <th className="px-4 py-2">User groups</th>
                <th className="px-4 py-2">Approvals</th>
                {isAdmin ? <th className="px-4 py-2">Reassign groups</th> : null}
                <th className="px-4 py-2 w-24" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 bg-white">
              {visible.map((row) => (
                <KnowledgeRow key={row.id} row={row} isAdmin={isAdmin} username={username} />
              ))}
            </tbody>
          </table>
        </div>
        {visible.length === 0 ? <p className="mt-4 text-sm text-neutral-500">No knowledge items yet.</p> : null}
      </section>

      <section className="mt-12 border-t border-neutral-200 pt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Create knowledge item</h2>
        <form onSubmit={onCreate} className="mt-4 max-w-xl space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
          </div>
          <fieldset>
            <legend className="text-sm font-medium text-neutral-700">User groups (who this hub is for)</legend>
            <div className="mt-2 flex flex-wrap gap-3 text-sm">
              {AUDIENCES.map((a) => (
                <label key={a} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={newAudiences.includes(a)}
                    onChange={() => toggleNewAudience(a)}
                  />
                  {audienceLabel(a)}
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <span className="text-sm font-medium text-neutral-700">Approvals (one per line)</span>
            {approvalLines.map((line, idx) => (
              <input
                key={idx}
                value={line}
                onChange={(e) =>
                  setApprovalLines((prev) => prev.map((p, i) => (i === idx ? e.target.value : p)))
                }
                className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                placeholder="e.g. Policy doc v3 — approved"
              />
            ))}
            <button
              type="button"
              className="mt-2 text-xs font-medium text-neutral-700 underline"
              onClick={() => setApprovalLines((p) => [...p, ""])}
            >
              + Add another approval
            </button>
          </div>
          {formErr ? (
            <p className="text-sm text-red-600" role="alert">
              {formErr}
            </p>
          ) : null}
          <button
            type="submit"
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            Save knowledge item
          </button>
        </form>
      </section>
    </div>
  );
}

function KnowledgeRow({
  row,
  isAdmin,
  username,
}: {
  row: KnowledgeItem;
  isAdmin: boolean;
  username: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draftAudiences, setDraftAudiences] = useState<HubAudience[]>(row.audiences);
  const [approvalDraft, setApprovalDraft] = useState(row.approvals.join("\n"));
  const canEdit = isAdmin || row.ownerUsername === username;

  useEffect(() => {
    setDraftAudiences(row.audiences);
    setApprovalDraft(row.approvals.join("\n"));
  }, [row.id, row.audiences, row.approvals]);

  const saveAudiences = useCallback(() => {
    updateKnowledgeAudiences(row.id, draftAudiences);
    setEditing(false);
  }, [row.id, draftAudiences]);

  const saveApprovals = useCallback(() => {
    const lines = approvalDraft.split("\n").map((s) => s.trim()).filter(Boolean);
    updateKnowledgeItem(row.id, username, isAdmin, { approvals: lines.length ? lines : ["(none)"] });
  }, [approvalDraft, row.id, username, isAdmin]);

  const onDelete = () => {
    if (!window.confirm("Delete this knowledge item?")) return;
    deleteKnowledgeItem(row.id, username, isAdmin);
  };

  return (
    <tr>
      <td className="px-4 py-3 align-top">
        <div className="font-medium text-neutral-900">{row.title}</div>
        <div className="mt-1 text-xs text-neutral-600">{row.description || "—"}</div>
      </td>
      <td className="px-4 py-3 align-top text-neutral-800">{row.ownerUsername}</td>
      <td className="px-4 py-3 align-top text-neutral-700">
        {row.audiences.map((a) => (
          <span key={a} className="mr-1 inline-block rounded border border-neutral-300 px-1.5 py-0.5 text-xs">
            {audienceLabel(a)}
          </span>
        ))}
      </td>
      <td className="px-4 py-3 align-top text-xs text-neutral-700">
        {canEdit ? (
          <div>
            <textarea
              value={approvalDraft}
              onChange={(e) => setApprovalDraft(e.target.value)}
              rows={Math.min(6, Math.max(2, row.approvals.length + 1))}
              className="w-full min-w-[180px] rounded border border-neutral-300 px-2 py-1 font-mono text-[11px] focus:border-neutral-900 focus:outline-none"
            />
            <button
              type="button"
              className="mt-1 text-xs font-medium text-neutral-900 underline"
              onClick={saveApprovals}
            >
              Save approvals
            </button>
          </div>
        ) : (
          <ul className="list-inside list-disc">
            {row.approvals.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        )}
      </td>
      {isAdmin ? (
        <td className="px-4 py-3 align-top">
          {editing ? (
            <div className="space-y-2">
              {AUDIENCES.map((a) => (
                <label key={a} className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={draftAudiences.includes(a)}
                    onChange={() =>
                      setDraftAudiences((prev) =>
                        prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a],
                      )
                    }
                  />
                  {audienceLabel(a)}
                </label>
              ))}
              <div className="flex gap-2">
                <button type="button" className="text-xs font-medium underline" onClick={saveAudiences}>
                  Save groups
                </button>
                <button
                  type="button"
                  className="text-xs text-neutral-500 underline"
                  onClick={() => {
                    setDraftAudiences(row.audiences);
                    setEditing(false);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="text-xs font-medium underline" onClick={() => setEditing(true)}>
              Edit groups
            </button>
          )}
        </td>
      ) : null}
      <td className="px-4 py-3 align-top">
        {canEdit ? (
          <button type="button" className="text-xs text-red-700 underline" onClick={onDelete}>
            Delete
          </button>
        ) : (
          <span className="text-xs text-neutral-400">—</span>
        )}
      </td>
    </tr>
  );
}
