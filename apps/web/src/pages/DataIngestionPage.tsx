import { type FormEvent, useMemo, useState } from "react";

import { useAuth } from "../auth/AuthContext";
import { filterEmbeddingLike, filterRerankLike } from "../lib/liteLLMModels";
import {
  KNOWLEDGE_CHANGED,
  listKnowledgeSorted,
  type KnowledgeItem,
} from "../lib/knowledgeStorage";
import { RAG_PROFILES_CHANGED, createRagProfile, deleteRagProfile, listRagProfiles } from "../lib/ragProfileStorage";
import type { TextSplitterKind } from "../lib/specTypes";
import { useLiteLLMModels } from "../lib/useLiteLLMModels";
import { useSyncedList } from "../lib/useSyncedList";

export default function DataIngestionPage() {
  const { user, realmRoles } = useAuth();
  const username = user?.profile.preferred_username ?? user?.sub ?? "";
  const isAdmin = realmRoles.has("admin") || realmRoles.has("platform-admin");
  const { models, loading: modelsLoading, error: modelsErr } = useLiteLLMModels();
  const embedOptions = useMemo(() => filterEmbeddingLike(models), [models]);
  const rerankOptions = useMemo(() => filterRerankLike(models), [models]);
  const profiles = useSyncedList(RAG_PROFILES_CHANGED, listRagProfiles);
  const knowledgeItems = useSyncedList(KNOWLEDGE_CHANGED, listKnowledgeSorted);

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
    setRerankModel(rerankOptions[0]?.id ?? "");
  };

  const onCreate = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createRagProfile({
      name,
      description,
      createdBy: username,
      partial: {
        knowledgeItemIds,
        embeddingModel: embeddingModel || embedOptions[0]?.id || "text-embedding-3-small",
        chunkSize,
        chunkOverlap,
        splitter,
        vectorStore: "lancedb",
        retrievalSemantic,
        retrievalHybrid,
        retrievalMetadata,
        hybridAlpha,
        hybridDedup,
        hybridReciprocalRankFusion: hybridRrf,
        useReranker,
        rerankModel: useReranker ? rerankModel : "",
      },
    });
    resetForm();
  };

  const toggleKnowledge = (id: string) => {
    setKnowledgeItemIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <header className="border-b border-neutral-200 pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Data ingestion (RAG)</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Configure retrieval profiles for LanceDB (single vector store). Execution is not run in the browser — this
          is the config contract for a future worker / LangChain pipeline.
        </p>
      </header>

      {modelsErr ? (
        <p className="mt-4 text-sm text-amber-800">Model list: {modelsErr} (using fallbacks where needed).</p>
      ) : null}

      <section className="mt-10 rounded-lg border border-neutral-200 bg-neutral-50/50 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">New RAG profile</h2>
        <form onSubmit={onCreate} className="mt-4 grid max-w-3xl gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
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
              <label className="block text-sm font-medium text-neutral-700">Embedding model (LiteLLM)</label>
              <select
                value={embeddingModel || embedOptions[0]?.id || ""}
                onChange={(e) => setEmbeddingModel(e.target.value)}
                disabled={modelsLoading}
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
            <label className="block text-sm font-medium text-neutral-700">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
            />
          </div>

          <fieldset className="rounded-md border border-neutral-200 bg-white p-3">
            <legend className="text-sm font-medium text-neutral-800">Knowledge sources</legend>
            <p className="text-xs text-neutral-500">Leave none selected to mean “all hubs” in this demo.</p>
            <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto text-sm">
              {knowledgeItems.map((k: KnowledgeItem) => (
                <li key={k.id}>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={knowledgeItemIds.includes(k.id)}
                      onChange={() => toggleKnowledge(k.id)}
                    />
                    {k.title}
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-neutral-700">Chunk size</label>
              <input
                type="number"
                min={64}
                value={chunkSize}
                onChange={(e) => setChunkSize(Number(e.target.value))}
                className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700">Chunk overlap</label>
              <input
                type="number"
                min={0}
                value={chunkOverlap}
                onChange={(e) => setChunkOverlap(Number(e.target.value))}
                className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700">Text splitter</label>
              <select
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
            <legend className="text-sm font-medium text-neutral-800">Retrieval</legend>
            <div className="mt-2 flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={retrievalSemantic} onChange={(e) => setRetrievalSemantic(e.target.checked)} />
                Semantic search
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={retrievalHybrid} onChange={(e) => setRetrievalHybrid(e.target.checked)} />
                Hybrid search
              </label>
              <label className="flex items-center gap-2">
                <input
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
                  <label className="text-xs font-medium text-neutral-600">Hybrid alpha (BM25 vs dense)</label>
                  <input
                    type="number"
                    step={0.05}
                    min={0}
                    max={1}
                    value={hybridAlpha}
                    onChange={(e) => setHybridAlpha(Number(e.target.value))}
                    className="mt-1 w-full rounded border px-2 py-1 text-sm"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={hybridDedup} onChange={(e) => setHybridDedup(e.target.checked)} />
                  Deduplicate hybrid hits
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={hybridRrf} onChange={(e) => setHybridRrf(e.target.checked)} />
                  Reciprocal rank fusion
                </label>
              </div>
            ) : null}
          </fieldset>

          <fieldset className="rounded-md border border-neutral-200 bg-white p-3">
            <legend className="text-sm font-medium text-neutral-800">Re-ranking (LiteLLM)</legend>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={useReranker} onChange={(e) => setUseReranker(e.target.checked)} />
              Use Cohere / rerank model via LiteLLM
            </label>
            {useReranker ? (
              <select
                value={rerankModel || rerankOptions[0]?.id || ""}
                onChange={(e) => setRerankModel(e.target.value)}
                className="mt-2 w-full max-w-md rounded-md border border-neutral-300 px-3 py-2 text-sm"
              >
                {rerankOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            ) : null}
          </fieldset>

          <button type="submit" className="w-fit rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white">
            Save profile
          </button>
        </form>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Saved profiles</h2>
        <ul className="mt-4 space-y-2">
          {profiles.map((p) => (
            <li key={p.id} className="rounded-lg border border-neutral-200 bg-white p-4 text-sm shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <span className="font-semibold text-neutral-900">{p.name}</span>
                  <p className="text-xs text-neutral-600">{p.description}</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    Embed: {p.embeddingModel} · chunk {p.chunkSize}/{p.chunkOverlap} · {p.splitter} · hybrid{" "}
                    {p.retrievalHybrid ? `α=${p.hybridAlpha}` : "off"}
                  </p>
                </div>
                {(isAdmin || p.createdBy === username) && (
                  <button
                    type="button"
                    className="text-xs text-red-700 underline"
                    onClick={() => deleteRagProfile(p.id, username, isAdmin)}
                  >
                    Delete
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
