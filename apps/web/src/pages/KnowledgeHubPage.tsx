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
  extractionLabel,
  filesToSources,
  indexingLabel,
  type HubAudience,
  type IndexingMode,
  type ExtractionLibrary,
  type KnowledgeItem,
  type MetadataPair,
  updateKnowledgeAudiences,
  updateKnowledgeItem,
} from "../lib/knowledgeStorage";
import { useKnowledgeList } from "../lib/useKnowledge";

const AUDIENCES: HubAudience[] = ["end_user", "developer", "admin"];

const EXTRACTION_OPTIONS: { value: ExtractionLibrary; label: string }[] = [
  { value: "auto", label: "Auto (pick by MIME type)" },
  { value: "pymupdf", label: "PyMuPDF (PDF / slides text + layout)" },
  { value: "surya", label: "Surya (OCR + layout)" },
  { value: "pymupdf_surya", label: "PyMuPDF + Surya (combined)" },
  { value: "plain_text", label: "Plain text only (no OCR)" },
  { value: "placeholder_av", label: "Audio / video (transcription — planned)" },
];

const INDEXING_OPTIONS: { value: IndexingMode; label: string }[] = [
  { value: "chunked_semantic", label: "Chunked semantic index (default RAG)" },
  { value: "document_level", label: "One embedding per source document" },
  { value: "unspecified", label: "Let platform default decide later" },
];

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

  const tableCols = isAdmin ? 8 : 7;
  const kPage = usePagination(visible, 10);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [newAudiences, setNewAudiences] = useState<HubAudience[]>([]);
  const [complianceLines, setComplianceLines] = useState<string[]>([""]);
  const [pendingFiles, setPendingFiles] = useState<FileList | null>(null);
  const [ocrEnabled, setOcrEnabled] = useState(false);
  const [extractionLibrary, setExtractionLibrary] = useState<ExtractionLibrary>("auto");
  const [indexingMode, setIndexingMode] = useState<IndexingMode>("chunked_semantic");
  const [metadataRequired, setMetadataRequired] = useState(false);
  const [metadataRows, setMetadataRows] = useState<MetadataPair[]>([{ key: "", value: "" }]);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const toggleNewAudience = (a: HubAudience) => {
    setNewAudiences((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  };

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    setFormErr(null);
    if (!title.trim()) {
      setFormErr("Title is required.");
      return;
    }
    setSaving(true);
    try {
      const files = pendingFiles ? Array.from(pendingFiles) : [];
      const sources = files.length ? await filesToSources(files) : [];
      const compliance = complianceLines.map((s) => s.trim()).filter(Boolean);
      const metaPairs = metadataRows.filter((r) => r.key.trim().length > 0);
      if (metadataRequired && metaPairs.length === 0) {
        setFormErr('You marked metadata as required — add at least one key/value pair (e.g. `team` / `finance`).');
        setSaving(false);
        return;
      }
      await createKnowledgeItem({
        ownerUsername: username,
        title,
        description,
        audiences: newAudiences,
        complianceNotes: compliance,
        sources,
        ocrEnabled,
        extractionLibrary,
        indexingMode,
        metadataRequired,
        metadataPairs: metaPairs,
      });
      showSuccess("Knowledge item saved.");
      setTitle("");
      setDescription("");
      setNewAudiences([]);
      setComplianceLines([""]);
      setPendingFiles(null);
      setOcrEnabled(false);
      setExtractionLibrary("auto");
      setIndexingMode("chunked_semantic");
      setMetadataRequired(false);
      setMetadataRows([{ key: "", value: "" }]);
      setCreateOpen(false);
    } catch {
      setFormErr("Could not read one of the files. Try a smaller text file or fewer attachments.");
    } finally {
      setSaving(false);
    }
  };

  const closeCreate = () => {
    setCreateOpen(false);
    setFormErr(null);
    setTitle("");
    setDescription("");
    setNewAudiences([]);
    setComplianceLines([""]);
    setPendingFiles(null);
    setOcrEnabled(false);
    setExtractionLibrary("auto");
    setIndexingMode("chunked_semantic");
    setMetadataRequired(false);
    setMetadataRows([{ key: "", value: "" }]);
  };

  return (
    <PageChrome
      title="Knowledge hub"
      description="Register corpora (files or text), how they should be extracted (PyMuPDF, Surya, OCR), and what metadata is stamped at index time. This UI stores configuration and small text previews locally; the ingestion worker uploads binaries to object storage and writes vectors — that pipeline is not executed in the browser."
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
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="bg-neutral-50 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-2">Title</th>
                <th className="px-4 py-2">Owner</th>
                <th className="px-4 py-2">Sources</th>
                <th className="px-4 py-2">Ingestion</th>
                <th className="px-4 py-2">Visibility</th>
                <th className="px-4 py-2">Metadata</th>
                <th className="px-4 py-2">Compliance notes</th>
                {isAdmin ? <th className="px-4 py-2">Reassign visibility</th> : null}
                <th className="w-24 px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 bg-white">
              {visible.length === 0 ? (
                <EmptyTablePlaceholder
                  colSpan={tableCols}
                  visual="folder"
                  title="No knowledge items yet"
                  description="Create a hub with attached sources and ingestion settings. Data stays in this browser until the backend pipeline is wired."
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
        <form onSubmit={onCreate} className="max-h-[85vh] space-y-4 overflow-y-auto pr-1">
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
            <strong>What this is:</strong> a catalog entry plus ingestion intent. PDFs, Office files, audio, and video
            are recorded as metadata here; full binary upload, OCR, and vector indexing run in{" "}
            <code className="rounded bg-amber-100/80 px-1">ingestion-worker</code> + MinIO (see README). Text files may
            show a preview stored locally (size-capped).
          </p>

          <div>
            <label htmlFor={`${createFormId}-title`} className="block text-sm font-medium text-neutral-700">
              Title <span className="text-red-600">*</span>
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
              rows={2}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              placeholder="What this corpus is for (not the file contents — attach sources below)."
            />
          </div>

          <fieldset className="rounded-md border border-neutral-200 bg-neutral-50/80 p-3">
            <legend className="text-sm font-medium text-neutral-800">Sources (attachments)</legend>
            <p className="mt-1 text-xs text-neutral-600">
              PDF, PPTX, TXT, MD, CSV, JSON, audio, video — all accepted as references. Binary bodies are not kept in
              localStorage; only name, MIME, size, and optional text preview.
            </p>
            <input
              id={`${createFormId}-files`}
              type="file"
              multiple
              className="mt-2 block w-full text-sm text-neutral-700 file:mr-3 file:rounded file:border-0 file:bg-neutral-800 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white"
              onChange={(e) => setPendingFiles(e.target.files)}
            />
            {pendingFiles && pendingFiles.length > 0 ? (
              <ul className="mt-2 list-inside list-disc text-xs text-neutral-700">
                {Array.from(pendingFiles).map((f) => (
                  <li key={`${f.name}-${f.size}`}>
                    {f.name} ({f.type || "unknown type"}) — {(f.size / 1024).toFixed(1)} KB
                  </li>
                ))}
              </ul>
            ) : null}
          </fieldset>

          <fieldset className="rounded-md border border-neutral-200 bg-white p-3">
            <legend className="text-sm font-medium text-neutral-800">Extraction & OCR</legend>
            <label htmlFor={`${createFormId}-ocr`} className="mt-2 flex items-center gap-2 text-sm">
              <input
                id={`${createFormId}-ocr`}
                type="checkbox"
                checked={ocrEnabled}
                onChange={(e) => setOcrEnabled(e.target.checked)}
              />
              Enable OCR for scanned pages / images / slide raster exports (planned: Surya in worker)
            </label>
            <div className="mt-3">
              <label htmlFor={`${createFormId}-extract`} className="block text-xs font-medium text-neutral-600">
                Default library
              </label>
              <select
                id={`${createFormId}-extract`}
                value={extractionLibrary}
                onChange={(e) => setExtractionLibrary(e.target.value as ExtractionLibrary)}
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              >
                {EXTRACTION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <p className="mt-2 text-xs text-neutral-500">
              <strong>Auto</strong> maps typical MIME types: PDF → PyMuPDF (text layer) with optional Surya when OCR is on;
              images → Surya when OCR is on; plain text → direct read. Audio/video use the transcribe placeholder until a
              speech stack is configured.
            </p>
          </fieldset>

          <fieldset className="rounded-md border border-neutral-200 bg-white p-3">
            <legend className="text-sm font-medium text-neutral-800">Indexing</legend>
            <label htmlFor={`${createFormId}-index`} className="block text-xs font-medium text-neutral-600">
              Index shape
            </label>
            <select
              id={`${createFormId}-index`}
              value={indexingMode}
              onChange={(e) => setIndexingMode(e.target.value as IndexingMode)}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            >
              {INDEXING_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </fieldset>

          <fieldset className="rounded-md border border-neutral-200 bg-white p-3">
            <legend className="text-sm font-medium text-neutral-800">Chunk metadata (optional)</legend>
            <p className="text-xs text-neutral-600">
              Key/value pairs are copied onto every chunk row in the vector index for filtering (e.g.{" "}
              <code>department</code>, <code>classification</code>).
            </p>
            <label htmlFor={`${createFormId}-meta-req`} className="mt-2 flex items-center gap-2 text-sm">
              <input
                id={`${createFormId}-meta-req`}
                type="checkbox"
                checked={metadataRequired}
                onChange={(e) => setMetadataRequired(e.target.checked)}
              />
              Require metadata at query time (retrieval must supply matching filters)
            </label>
            <div className="mt-3 space-y-2">
              {metadataRows.map((row, idx) => (
                <div key={idx} className="flex flex-wrap gap-2">
                  <input
                    aria-label={`Metadata key ${idx + 1}`}
                    value={row.key}
                    onChange={(e) =>
                      setMetadataRows((prev) => prev.map((r, i) => (i === idx ? { ...r, key: e.target.value } : r)))
                    }
                    placeholder="key"
                    className="min-w-[120px] flex-1 rounded border border-neutral-300 px-2 py-1 text-sm"
                  />
                  <input
                    aria-label={`Metadata value ${idx + 1}`}
                    value={row.value}
                    onChange={(e) =>
                      setMetadataRows((prev) => prev.map((r, i) => (i === idx ? { ...r, value: e.target.value } : r)))
                    }
                    placeholder="value"
                    className="min-w-[120px] flex-1 rounded border border-neutral-300 px-2 py-1 text-sm"
                  />
                  <button
                    type="button"
                    className="text-xs text-red-700 underline"
                    onClick={() => setMetadataRows((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="text-xs font-medium text-neutral-800 underline"
                onClick={() => setMetadataRows((p) => [...p, { key: "", value: "" }])}
              >
                + Add metadata field
              </button>
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium text-neutral-700">Visibility (optional)</legend>
            <p className="mt-1 text-xs text-neutral-500">
              Leave empty for <strong>owner-only</strong> in this demo. Checking a cohort lets those roles see the hub
              in the list (no separate ACL engine yet).
            </p>
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
            <legend className="text-sm font-medium text-neutral-700">Compliance notes (optional)</legend>
            <p className="mt-1 text-xs text-neutral-500">
              Free-text references (policy IDs, ticket numbers). Not validated and not an approval workflow.
            </p>
            {complianceLines.map((line, idx) => (
              <div key={idx} className="mt-2">
                <label htmlFor={`${createFormId}-compliance-${idx}`} className="sr-only">
                  Compliance line {idx + 1}
                </label>
                <input
                  id={`${createFormId}-compliance-${idx}`}
                  value={line}
                  onChange={(e) =>
                    setComplianceLines((prev) => prev.map((p, i) => (i === idx ? e.target.value : p)))
                  }
                  className="block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                  placeholder="e.g. POL-1234 or Legal review ticket"
                />
              </div>
            ))}
            <button
              type="button"
              className="mt-2 text-xs font-medium text-neutral-700 underline"
              onClick={() => setComplianceLines((p) => [...p, ""])}
            >
              + Add another line
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
              disabled={saving}
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save knowledge item"}
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
  const [complianceDraft, setComplianceDraft] = useState(row.complianceNotes.join("\n"));
  const canEdit = isAdmin || row.ownerUsername === username;

  useEffect(() => {
    setDraftAudiences(row.audiences);
    setComplianceDraft(row.complianceNotes.join("\n"));
  }, [row.id, row.audiences, row.complianceNotes]);

  const saveAudiences = useCallback(async () => {
    await updateKnowledgeAudiences(row.id, draftAudiences);
    setEditing(false);
    showSuccess("Visibility updated.");
  }, [row.id, draftAudiences, showSuccess]);

  const saveCompliance = useCallback(async () => {
    const lines = complianceDraft.split("\n").map((s) => s.trim()).filter(Boolean);
    await updateKnowledgeItem(row.id, username, isAdmin, { complianceNotes: lines.length ? lines : [] });
    showSuccess("Compliance notes saved.");
  }, [complianceDraft, row.id, username, isAdmin, showSuccess]);

  const onDelete = async () => {
    if (!window.confirm("Delete this knowledge item?")) return;
    await deleteKnowledgeItem(row.id);
    showSuccess("Knowledge item removed.");
  };

  const ingestionSummary = `${extractionLabel(row.extractionLibrary)}${row.ocrEnabled ? " · OCR" : ""} · ${indexingLabel(row.indexingMode)}`;

  return (
    <tr>
      <td className="px-4 py-3 align-top">
        <div className="font-medium text-neutral-900">{row.title}</div>
        <div className="mt-1 text-xs text-neutral-600">{row.description || "—"}</div>
      </td>
      <td className="px-4 py-3 align-top text-neutral-800">{row.ownerUsername}</td>
      <td className="px-4 py-3 align-top text-xs text-neutral-700">
        {row.sources.length === 0 ? (
          <span className="italic text-neutral-500">No files</span>
        ) : (
          <ul className="max-w-[200px] space-y-1">
            {row.sources.map((s) => (
              <li key={s.id} className="truncate" title={`${s.name} ${s.textPreview ? "(text preview stored)" : ""}`}>
                <span className="font-mono text-[10px] text-neutral-500">{s.mimeType.split("/").pop()}</span>{" "}
                {s.name}
              </li>
            ))}
          </ul>
        )}
      </td>
      <td className="px-4 py-3 align-top text-xs text-neutral-700">{ingestionSummary}</td>
      <td className="px-4 py-3 align-top text-neutral-700">
        {row.audiences.length === 0 ? (
          <span className="text-xs italic text-neutral-500">Owner only</span>
        ) : (
          row.audiences.map((a) => (
            <span key={a} className="mr-1 inline-block rounded border border-neutral-300 px-1.5 py-0.5 text-xs">
              {audienceLabel(a)}
            </span>
          ))
        )}
      </td>
      <td className="px-4 py-3 align-top text-xs text-neutral-700">
        {row.metadataRequired ? (
          <span className="font-medium text-amber-800">Required</span>
        ) : (
          <span className="text-neutral-500">Optional</span>
        )}
        {row.metadataPairs.length > 0 ? (
          <ul className="mt-1 list-inside list-disc text-[11px]">
            {row.metadataPairs.slice(0, 4).map((p) => (
              <li key={p.key}>
                <code>{p.key}</code>={p.value}
              </li>
            ))}
            {row.metadataPairs.length > 4 ? <li>…</li> : null}
          </ul>
        ) : (
          <p className="mt-1 text-neutral-500">—</p>
        )}
      </td>
      <td className="px-4 py-3 align-top text-xs text-neutral-700">
        {canEdit ? (
          <div>
            <label htmlFor={`${rowFieldId}-compliance`} className="sr-only">
              Compliance notes for {row.title}
            </label>
            <textarea
              id={`${rowFieldId}-compliance`}
              value={complianceDraft}
              onChange={(e) => setComplianceDraft(e.target.value)}
              rows={Math.min(6, Math.max(2, row.complianceNotes.length + 1))}
              className="w-full min-w-[180px] rounded border border-neutral-300 px-2 py-1 font-mono text-[11px]"
            />
            <button
              type="button"
              className="mt-1 text-xs font-medium text-neutral-900 underline"
              onClick={saveCompliance}
            >
              Save notes
            </button>
          </div>
        ) : row.complianceNotes.length === 0 ? (
          <p className="text-xs text-neutral-500">None.</p>
        ) : (
          <ul className="list-inside list-disc">
            {row.complianceNotes.map((a) => (
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
                  Save visibility
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
              Edit visibility
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
