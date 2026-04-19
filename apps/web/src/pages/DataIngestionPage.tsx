import { type FormEvent, useEffect, useId, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { Dialog } from "../components/Dialog";
import { useFlash } from "../components/FlashContext";
import { EmptyState } from "../components/EmptyState";
import { EmptyTablePlaceholder } from "../components/EmptyTablePlaceholder";
import { PageChrome } from "../components/PageChrome";
import { TablePagination } from "../components/TablePagination";
import { usePagination } from "../hooks/usePagination";
import { filterEmbeddingLike, mergeRerankCatalog } from "../lib/liteLLMModels";
import { KNOWLEDGE_CHANGED, listKnowledgeSorted, type KnowledgeItem } from "../lib/knowledgeStorage";
import {
  RAG_PROFILES_CHANGED,
  createRagProfile,
  deleteRagProfile,
  listRagProfiles,
} from "../lib/ragProfileStorage";
import type { TextSplitterKind } from "../lib/specTypes";
import { useLiteLLMModels } from "../lib/useLiteLLMModels";
import { useRemoteList } from "../lib/useRemoteList";

export default function DataIngestionPage() {
  const { user, realmRoles } = useAuth();
  const formId = useId();
  const { showSuccess } = useFlash();
  const username = user?.profile.preferred_username ?? user?.sub ?? "";
  const isAdmin = realmRoles.has("admin") || realmRoles.has("platform-admin");
  const { models, loading: modelsLoading, error: modelsError } = useLiteLLMModels();
  const embedOptions = useMemo(() => filterEmbeddingLike(models), [models]);
  const rerankOptions = useMemo(() => mergeRerankCatalog(models), [models]);
  const profiles = useRemoteList(RAG_PROFILES_CHANGED, listRagProfiles);
  const profilesPage = usePagination(profiles, 10);
  const knowledgeItems = useRemoteList(KNOWLEDGE_CHANGED, listKnowledgeSorted);

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [knowledgeItemIds, setKnowledgeItemIds] = useState<string[]>([]);
  const [embeddingModel, setEmbeddingModel] = useState("");
  const [chunkSize, setChunkSize] = useState(512);
  const [chunkOverlap, setChunkOverlap] = useState(64);
  const [splitter, setSplitter] = useState<TextSplitterKind>("recursive");
  const [retrievalSemantic, setRetrievalSemantic] = useState(true);
  const [retrievalHybrid, setRetrievalHybrid] = useState(false);
  const [retrievalMetadata, setRetrievalMetadata] = useState(false);
  const [hybridAlpha, setHybridAlpha] = useState(0.5);
  const [hybridDedup, setHybridDedup] = useState(true);
  const [hybridRrf, setHybridRrf] = useState(false);
  const [useReranker, setUseReranker] = useState(false);
  const [rerankModel, setRerankModel] = useState("");
  const [formErr, setFormErr] = useState<string | null>(null);

  useEffect(() => {
    if (embedOptions.length && !embeddingModel) {
      setEmbeddingModel(embedOptions[0].id);
    }
  }, [embedOptions, embeddingModel]);

  useEffect(() => {
    if (rerankOptions.length && !rerankModel) {
      const cohere = rerankOptions.find((m) => m.id.includes("cohere/rerank-english"));
      setRerankModel(cohere?.id ?? rerankOptions[0].id);
    }
  }, [rerankOptions, rerankModel]);

  const resetForm = () => {
    setName("");
    setDescription("");
    setKnowledgeItemIds([]);
    setEmbeddingModel(embedOptions[0]?.id ?? "");
    setChunkSize(512);
    setChunkOverlap(64);
    setSplitter("recursive");
    setRetrievalSemantic(true);
    setRetrievalHybrid(false);
    setRetrievalMetadata(false);
    setHybridAlpha(0.5);
    setHybridDedup(true);
    setHybridRrf(false);
    setUseReranker(false);
    const cohere = rerankOptions.find((m) => m.id.includes("cohere/rerank-english"));
    setRerankModel(cohere?.id ?? rerankOptions[0]?.id ?? "");
    setFormErr(null);
  };

  const closeDialog = () => {
    setCreateOpen(false);
    resetForm();
  };

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormErr("Name is required.");
      return;
    }
    if (useReranker && !rerankModel.trim()) {
      setFormErr("Select a rerank model or turn off reranking.");
      return;
    }
    setFormErr(null);
    const partial = {
      knowledgeItemIds,
      embeddingModel: embeddingModel || embedOptions[0]?.id || "text-embedding-3-small",
      chunkSize,
      chunkOverlap,
      splitter,
      vectorStore: "lancedb" as const,
      retrievalSemantic,
      retrievalHybrid,
      retrievalMetadata,
      hybridAlpha,
      hybridDedup,
      hybridReciprocalRankFusion: hybridRrf,
      useReranker,
      rerankModel: useReranker ? rerankModel : "",
    };
    await createRagProfile({ name, description, createdBy: username, partial });
    showSuccess("Retrieval profile saved.");
    closeDialog();
  };

  const toggleKnowledge = (id: string) => {
    setKnowledgeItemIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <PageChrome
      title="RAG & ingestion"
      description="One place for ingestion settings (chunking, embeddings) and retrieval (semantic / hybrid, metadata filters, rerank). Knowledge hub registers sources; this page defines how they are embedded and queried. Profiles are stored in Postgres; wire `ingestion-worker` + LiteLLM (Cohere rerank needs `COHERE_API_KEY` on the proxy) for production."
      actions={
        <button
          type="button"
          onClick={() => {
            resetForm();
            setCreateOpen(true);
          }}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          New retrieval profile
        </button>
      }
    >
      <section className="mt-8 grid gap-4 rounded-lg border border-neutral-200 bg-neutral-50/60 p-5 md:grid-cols-2">
        <div>
          <h2 className="text-sm font-semibold text-neutral-800">1. Sources (Knowledge hub)</h2>
          <p className="mt-2 text-sm text-neutral-600">
            Attach files and ingestion options per hub under{" "}
            <Link to="/knowledge" className="font-medium text-neutral-900 underline">
              Knowledge
            </Link>
            . Retrieval profiles here scope which hubs feed each pipeline (or leave none for “all hubs” in this demo).
          </p>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-neutral-800">2. Retrieval profile (this page)</h2>
          <p className="mt-2 text-sm text-neutral-600">
            Chunking, embedding model, vector store target, hybrid / metadata retrieval, and optional{" "}
            <strong>Cohere rerank</strong> (LiteLLM id <code className="rounded bg-white px-1">cohere/rerank-*</code>) live
            in a saved profile. Use <strong>New retrieval profile</strong> to open the editor.
          </p>
        </div>
      </section>

      {modelsError ? (
        <p className="mt-4 text-sm text-amber-800" role="status">
          Model list fallback: {modelsError}
        </p>
      ) : null}
      {modelsLoading ? <p className="mt-2 text-xs text-neutral-500">Loading model catalog…</p> : null}

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Saved retrieval profiles</h2>
        <div className="mt-4 overflow-hidden rounded-lg border border-neutral-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Embedding &amp; retrieval</th>
                <th className="w-24 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 bg-white">
              {profiles.length === 0 ? (
                <EmptyTablePlaceholder
                  colSpan={4}
                  visual="pipeline"
                  title="No retrieval profiles yet"
                  description="RAG and ingestion share this profile: chunking, embeddings, hybrid search, and optional Cohere rerank. Create one with the button above."
                  action={
                    <button
                      type="button"
                      onClick={() => {
                        resetForm();
                        setCreateOpen(true);
                      }}
                      className="rounded-md bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800"
                    >
                      New retrieval profile
                    </button>
                  }
                />
              ) : (
                profilesPage.pageItems.map((p) => (
                  <tr key={p.id} className="align-top hover:bg-neutral-50/80">
                    <td className="px-4 py-3 font-medium text-neutral-900">{p.name}</td>
                    <td className="max-w-xs px-4 py-3 text-xs text-neutral-600">{p.description || "—"}</td>
                    <td className="px-4 py-3 text-xs text-neutral-600">
                      {p.embeddingModel} · {p.chunkSize}/{p.chunkOverlap} · {p.splitter}
                      {p.retrievalHybrid ? ` · hybrid α=${p.hybridAlpha}` : ""}
                      {p.useReranker && p.rerankModel ? ` · rerank: ${p.rerankModel}` : ""}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {isAdmin || p.createdBy === username ? (
                        <button
                          type="button"
                          className="text-red-700 underline"
                          onClick={async () => {
                            await deleteRagProfile(p.id);
                            showSuccess("Profile removed.");
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
            label="retrieval profiles"
            page={profilesPage.page}
            totalPages={profilesPage.totalPages}
            total={profilesPage.total}
            from={profilesPage.from}
            to={profilesPage.to}
            onPageChange={profilesPage.setPage}
          />
        </div>
      </section>

      <Dialog
        open={createOpen}
        onClose={closeDialog}
        title="New retrieval profile (ingestion + RAG)"
        description="Chunking and embeddings are the ingestion half; retrieval toggles and rerank are the query half — one saved profile covers both."
        size="xl"
      >
        <form onSubmit={onCreate} className="max-h-[82vh] space-y-4 overflow-y-auto pr-1">
          {formErr ? (
            <p className="text-sm text-red-600" role="alert">
              {formErr}
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={`${formId}-name`} className="block text-sm font-medium text-neutral-700">
                Name <span className="text-red-600">*</span>
              </label>
              <input
                id={`${formId}-name`}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setFormErr(null);
                }}
                className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
                placeholder="e.g. Finance docs — hybrid + Cohere rerank"
              />
            </div>
            <div>
              <label htmlFor={`${formId}-embed`} className="block text-sm font-medium text-neutral-700">
                Embedding model
              </label>
              <select
                id={`${formId}-embed`}
                value={embeddingModel || embedOptions[0]?.id || ""}
                onChange={(e) => setEmbeddingModel(e.target.value)}
                disabled={embedOptions.length === 0}
                className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
              >
                {embedOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
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

          <fieldset className="rounded-md border border-neutral-200 bg-white p-3">
            <legend className="text-sm font-medium text-neutral-800">Knowledge scope</legend>
            <p className="text-xs text-neutral-500">Leave none selected to mean “all hubs” in this demo.</p>
            <div className="mt-2 max-h-40 overflow-y-auto rounded-md border border-neutral-100 bg-neutral-50/50">
              {knowledgeItems.length === 0 ? (
                <EmptyState
                  compact
                  visual="folder"
                  title="No knowledge hubs yet"
                  description={
                    <>
                      Add hubs under{" "}
                      <Link to="/knowledge" className="font-medium underline">
                        Knowledge
                      </Link>{" "}
                      first, or save this profile with no selection for “all hubs”.
                    </>
                  }
                  className="max-w-none px-2"
                />
              ) : (
                <ul className="space-y-1 p-2 text-sm">
                  {knowledgeItems.map((k: KnowledgeItem) => (
                    <li key={k.id}>
                      <label htmlFor={`${formId}-ks-${k.id}`} className="flex cursor-pointer items-center gap-2">
                        <input
                          id={`${formId}-ks-${k.id}`}
                          type="checkbox"
                          checked={knowledgeItemIds.includes(k.id)}
                          onChange={() => toggleKnowledge(k.id)}
                        />
                        {k.title}
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </fieldset>

          <div className="rounded-md border border-neutral-200 bg-neutral-50/80 px-3 py-2 text-xs text-neutral-700">
            <strong>Ingestion</strong> — chunking and embedding drive what gets written to the vector index;{" "}
            <strong>RAG</strong> — retrieval options below drive how queries hit that index at runtime.
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor={`${formId}-chunk`} className="block text-sm font-medium text-neutral-700">
                Chunk size
              </label>
              <input
                id={`${formId}-chunk`}
                type="number"
                min={64}
                value={chunkSize}
                onChange={(e) => setChunkSize(Number(e.target.value))}
                className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor={`${formId}-overlap`} className="block text-sm font-medium text-neutral-700">
                Chunk overlap
              </label>
              <input
                id={`${formId}-overlap`}
                type="number"
                min={0}
                value={chunkOverlap}
                onChange={(e) => setChunkOverlap(Number(e.target.value))}
                className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor={`${formId}-splitter`} className="block text-sm font-medium text-neutral-700">
                Text splitter
              </label>
              <select
                id={`${formId}-splitter`}
                value={splitter}
                onChange={(e) => setSplitter(e.target.value as TextSplitterKind)}
                className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
              >
                <option value="recursive">Recursive</option>
                <option value="token">Token</option>
                <option value="markdown">Markdown</option>
              </select>
            </div>
          </div>

          <div>
            <span className="text-sm font-medium text-neutral-800">Vector store</span>
            <p className="mt-1 rounded border border-neutral-200 bg-neutral-100 px-3 py-2 text-sm">LanceDB (default)</p>
          </div>

          <fieldset className="rounded-md border border-neutral-200 bg-white p-3">
            <legend className="text-sm font-medium text-neutral-800">Retrieval (RAG)</legend>
            <div className="mt-2 flex flex-wrap gap-4 text-sm">
              <label htmlFor={`${formId}-ret-semantic`} className="flex items-center gap-2">
                <input
                  id={`${formId}-ret-semantic`}
                  type="checkbox"
                  checked={retrievalSemantic}
                  onChange={(e) => setRetrievalSemantic(e.target.checked)}
                />
                Semantic search
              </label>
              <label htmlFor={`${formId}-ret-hybrid`} className="flex items-center gap-2">
                <input
                  id={`${formId}-ret-hybrid`}
                  type="checkbox"
                  checked={retrievalHybrid}
                  onChange={(e) => setRetrievalHybrid(e.target.checked)}
                />
                Hybrid search
              </label>
              <label htmlFor={`${formId}-ret-meta`} className="flex items-center gap-2">
                <input
                  id={`${formId}-ret-meta`}
                  type="checkbox"
                  checked={retrievalMetadata}
                  onChange={(e) => setRetrievalMetadata(e.target.checked)}
                />
                Metadata filtering
              </label>
            </div>
            {retrievalHybrid ? (
              <div className="mt-4 grid gap-3 border-t border-neutral-100 pt-3 sm:grid-cols-2">
                <div>
                  <label htmlFor={`${formId}-hybrid-alpha`} className="text-xs font-medium text-neutral-600">
                    Hybrid alpha (BM25 vs dense)
                  </label>
                  <input
                    id={`${formId}-hybrid-alpha`}
                    type="number"
                    step={0.05}
                    min={0}
                    max={1}
                    value={hybridAlpha}
                    onChange={(e) => setHybridAlpha(Number(e.target.value))}
                    className="mt-1 w-full rounded border px-2 py-1 text-sm"
                  />
                </div>
                <label htmlFor={`${formId}-hybrid-dedup`} className="flex items-center gap-2 text-sm">
                  <input
                    id={`${formId}-hybrid-dedup`}
                    type="checkbox"
                    checked={hybridDedup}
                    onChange={(e) => setHybridDedup(e.target.checked)}
                  />
                  Deduplicate hybrid hits
                </label>
                <label htmlFor={`${formId}-hybrid-rrf`} className="flex items-center gap-2 text-sm">
                  <input
                    id={`${formId}-hybrid-rrf`}
                    type="checkbox"
                    checked={hybridRrf}
                    onChange={(e) => setHybridRrf(e.target.checked)}
                  />
                  Reciprocal rank fusion
                </label>
              </div>
            ) : null}
          </fieldset>

          <fieldset className="rounded-md border border-neutral-200 bg-white p-3">
            <legend className="text-sm font-medium text-neutral-800">Reranking</legend>
            <p className="text-xs text-neutral-600">
              <strong>Cohere rerank</strong> models are listed as{" "}
              <code className="rounded bg-neutral-100 px-1">cohere/rerank-*</code> for LiteLLM. Add them to the proxy
              config and set <code className="rounded bg-neutral-100 px-1">COHERE_API_KEY</code> so Python / LiteLLM can
              call the official API.
            </p>
            <label htmlFor={`${formId}-use-rerank`} className="mt-3 flex items-center gap-2 text-sm">
              <input
                id={`${formId}-use-rerank`}
                type="checkbox"
                checked={useReranker}
                onChange={(e) => setUseReranker(e.target.checked)}
              />
              Enable cross-encoder / rerank step after retrieval
            </label>
            {useReranker ? (
              <>
                <label htmlFor={`${formId}-rerank-model`} className="mt-2 block text-xs font-medium text-neutral-600">
                  Rerank model (catalog + Cohere presets)
                </label>
                <select
                  id={`${formId}-rerank-model`}
                  value={rerankModel || rerankOptions[0]?.id || ""}
                  onChange={(e) => setRerankModel(e.target.value)}
                  className="mt-1 w-full max-w-xl rounded-md border border-neutral-300 px-3 py-2 text-sm"
                >
                  {rerankOptions.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </>
            ) : null}
          </fieldset>

          <div className="flex flex-wrap justify-end gap-2 border-t border-neutral-200 pt-4">
            <button type="button" className="rounded-md border border-neutral-300 px-4 py-2 text-sm" onClick={closeDialog}>
              Cancel
            </button>
            <button type="submit" className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white">
              Save profile
            </button>
          </div>
        </form>
      </Dialog>
    </PageChrome>
  );
}
