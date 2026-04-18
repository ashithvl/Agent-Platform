import { type FormEvent, useCallback, useEffect, useId, useMemo, useState } from "react";

import { useAuth } from "../auth/AuthContext";
import { Dialog } from "../components/Dialog";
import { useFlash } from "../components/FlashContext";
import { EmptyTablePlaceholder } from "../components/EmptyTablePlaceholder";
import { PageChrome } from "../components/PageChrome";
import { TablePagination } from "../components/TablePagination";
import { usePagination } from "../hooks/usePagination";
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
  const createFormId = useId();
  const { showSuccess } = useFlash();
  const items = useKnowledgeList();
  const username = user?.profile.preferred_username ?? user?.sub ?? "";
  const isAdmin = realmRoles.has("admin") || realmRoles.has("platform-admin");

  const visible = useMemo(() => {
    if (isAdmin) return items;
    return items.filter((i) => i.ownerUsername === username || i.audiences.includes("developer"));
  }, [items, isAdmin, username]);

  const tableCols = isAdmin ? 6 : 5;
  const kPage = usePagination(visible, 10);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [newAudiences, setNewAudiences] = useState<HubAudience[]>(["developer"]);
  const [approvalLines, setApprovalLines] = useState<string[]>([""]);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

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
    showSuccess("Knowledge item saved.");
    setTitle("");
    setDescription("");
    setNewAudiences(["developer"]);
    setApprovalLines([""]);
    setCreateOpen(false);
  };

  const closeCreate = () => {
    setCreateOpen(false);
    setFormErr(null);
    setTitle("");
    setDescription("");
    setNewAudiences(["developer"]);
    setApprovalLines([""]);
  };

  return (
    <PageChrome
      title="Knowledge hub"
      description="Multiple knowledge items per person; each item can carry many approvals. Admins see every hub and which user group it serves. Developers manage their own hubs and anything shared with the developer cohort."
      actions={
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          Add knowledge item
        </button>
      }
    >
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
                <th className="w-24 px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 bg-white">
              {visible.length === 0 ? (
                <EmptyTablePlaceholder
                  colSpan={tableCols}
                  visual="folder"
                  title="No knowledge items yet"
                  description="Create a hub to attach approvals and audiences. Everything is stored locally in this browser."
                  action={
                    <button
                      type="button"
                      onClick={() => setCreateOpen(true)}
                      className="rounded-md bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800"
                    >
                      Add knowledge item
                    </button>
                  }
                />
              ) : (
                kPage.pageItems.map((row) => (
                  <KnowledgeRow key={row.id} row={row} isAdmin={isAdmin} username={username} showSuccess={showSuccess} />
                ))
              )}
            </tbody>
          </table>
          <TablePagination
            label="knowledge items"
            page={kPage.page}
            totalPages={kPage.totalPages}
            total={kPage.total}
            from={kPage.from}
            to={kPage.to}
            onPageChange={kPage.setPage}
          />
        </div>
      </section>

      <Dialog open={createOpen} onClose={closeCreate} title="Create knowledge item" size="lg">
        <form onSubmit={onCreate} className="space-y-4">
          <div>
            <label htmlFor={`${createFormId}-title`} className="block text-sm font-medium text-neutral-700">
              Title
            </label>
            <input
              id={`${createFormId}-title`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor={`${createFormId}-description`} className="block text-sm font-medium text-neutral-700">
              Description
            </label>
            <textarea
              id={`${createFormId}-description`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          <fieldset>
            <legend className="text-sm font-medium text-neutral-700">User groups (who this hub is for)</legend>
            <div className="mt-2 flex flex-wrap gap-3 text-sm">
              {AUDIENCES.map((a) => (
                <label key={a} htmlFor={`${createFormId}-aud-${a}`} className="flex items-center gap-2">
                  <input
                    id={`${createFormId}-aud-${a}`}
                    type="checkbox"
                    checked={newAudiences.includes(a)}
                    onChange={() => toggleNewAudience(a)}
                  />
                  {audienceLabel(a)}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="min-w-0 border-0 p-0">
            <legend className="text-sm font-medium text-neutral-700">Approvals (one per line)</legend>
            {approvalLines.map((line, idx) => (
              <div key={idx} className="mt-2">
                <label htmlFor={`${createFormId}-approval-${idx}`} className="sr-only">
                  Approval line {idx + 1}
                </label>
                <input
                  id={`${createFormId}-approval-${idx}`}
                  value={line}
                  onChange={(e) =>
                    setApprovalLines((prev) => prev.map((p, i) => (i === idx ? e.target.value : p)))
                  }
                  className="block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                  placeholder="e.g. Policy doc v3 — approved"
                />
              </div>
            ))}
            <button
              type="button"
              className="mt-2 text-xs font-medium text-neutral-700 underline"
              onClick={() => setApprovalLines((p) => [...p, ""])}
            >
              + Add another approval
            </button>
          </fieldset>
          {formErr ? (
            <p className="text-sm text-red-600" role="alert">
              {formErr}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2 border-t border-neutral-200 pt-4">
            <button type="button" className="rounded-md border border-neutral-300 px-4 py-2 text-sm" onClick={closeCreate}>
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
            >
              Save knowledge item
            </button>
          </div>
        </form>
      </Dialog>
    </PageChrome>
  );
}

function KnowledgeRow({
  row,
  isAdmin,
  username,
  showSuccess,
}: {
  row: KnowledgeItem;
  isAdmin: boolean;
  username: string;
  showSuccess: (message: string) => void;
}) {
  const rowFieldId = useId();
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
    showSuccess("User groups updated.");
  }, [row.id, draftAudiences, showSuccess]);

  const saveApprovals = useCallback(() => {
    const lines = approvalDraft.split("\n").map((s) => s.trim()).filter(Boolean);
    updateKnowledgeItem(row.id, username, isAdmin, { approvals: lines.length ? lines : ["(none)"] });
    showSuccess("Approvals saved.");
  }, [approvalDraft, row.id, username, isAdmin, showSuccess]);

  const onDelete = () => {
    if (!window.confirm("Delete this knowledge item?")) return;
    deleteKnowledgeItem(row.id, username, isAdmin);
    showSuccess("Knowledge item removed.");
  };

  return (
    <tr>
      <td className="px-4 py-3 align-top">
        <div className="font-medium text-neutral-900">{row.title}</div>
        <div className="mt-1 text-xs text-neutral-600">{row.description || "—"}</div>
      </td>
      <td className="px-4 py-3 align-top text-neutral-800">{row.ownerUsername}</td>
      <td className="px-4 py-3 align-top text-neutral-700">
        {row.audiences.length === 0 ? (
          <span className="text-xs italic text-neutral-500">No groups assigned</span>
        ) : (
          row.audiences.map((a) => (
            <span key={a} className="mr-1 inline-block rounded border border-neutral-300 px-1.5 py-0.5 text-xs">
              {audienceLabel(a)}
            </span>
          ))
        )}
      </td>
      <td className="px-4 py-3 align-top text-xs text-neutral-700">
        {canEdit ? (
          <div>
            <label htmlFor={`${rowFieldId}-approvals`} className="sr-only">
              Approvals for {row.title}
            </label>
            <textarea
              id={`${rowFieldId}-approvals`}
              value={approvalDraft}
              onChange={(e) => setApprovalDraft(e.target.value)}
              rows={Math.min(6, Math.max(2, row.approvals.length + 1))}
              className="w-full min-w-[180px] rounded border border-neutral-300 px-2 py-1 font-mono text-[11px]"
            />
            <button
              type="button"
              className="mt-1 text-xs font-medium text-neutral-900 underline"
              onClick={saveApprovals}
            >
              Save approvals
            </button>
          </div>
        ) : row.approvals.length === 0 ? (
          <p className="text-xs text-neutral-500">No approvals listed.</p>
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
                <label key={a} htmlFor={`${rowFieldId}-grp-${a}`} className="flex items-center gap-2 text-xs">
                  <input
                    id={`${rowFieldId}-grp-${a}`}
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
