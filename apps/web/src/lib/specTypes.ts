/** Global tool registry — only MCP is supported for new registrations. */
export type ToolKind = "mcp";

/** Remote MCP transport (stdio / IO omitted in this UI). */
export type McpTransport = "sse" | "http";

export type Tool = {
  id: string;
  name: string;
  kind: ToolKind;
  description: string;
  createdBy: string;
  createdAt: number;
  /** How the MCP client reaches the server (SSE or HTTP). */
  mcpTransport: McpTransport;
  /**
   * Full MCP server connection config as JSON (e.g. `url`, `capabilities`, auth blocks).
   * Must be a JSON object when saved from the UI.
   */
  mcpConfigJson: string;
  /** Optional HTTP headers merged by the runtime (not executed in this demo app). */
  headersJson?: string;
  /** @deprecated Migrated into `mcpConfigJson` on read — may still exist in old localStorage. */
  serverUrl?: string;
  /** @deprecated Free text — use `mcpTransport` + `mcpConfigJson`. */
  transport?: string;
};

/** LangChain-oriented agent definition (config only). */
export type AgentSpec = {
  id: string;
  name: string;
  model: string;
  systemPrompt: string;
  /** Runtime context slot names callers fill (e.g. user_id, rag_snippets). */
  contextVariableNames: string[];
  toolIds: string[];
  status: "active" | "paused";
  createdBy: string;
  createdAt: number;
  updatedAt: number;
};

export type TextSplitterKind = "recursive" | "token" | "markdown";

export type RagProfile = {
  id: string;
  name: string;
  description: string;
  /** Knowledge hub item ids; empty = all hubs (demo). */
  knowledgeItemIds: string[];
  embeddingModel: string;
  chunkSize: number;
  chunkOverlap: number;
  splitter: TextSplitterKind;
  vectorStore: "lancedb";
  retrievalSemantic: boolean;
  retrievalHybrid: boolean;
  retrievalMetadata: boolean;
  hybridAlpha: number;
  hybridDedup: boolean;
  hybridReciprocalRankFusion: boolean;
  useReranker: boolean;
  rerankModel: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
};

export type PipelineStep =
  | {
      type: "agent";
      agentId: string;
      guardBeforeId?: string;
      guardAfterId?: string;
    }
  | {
      type: "rag";
      ragProfileId: string;
      guardBeforeId?: string;
      guardAfterId?: string;
    };

/** Sequential LangGraph-style pipeline (config only). */
export type WorkflowPipeline = {
  id: string;
  name: string;
  description: string;
  steps: PipelineStep[];
  createdBy: string;
  createdAt: number;
  updatedAt: number;
};

export type NeMoPlacement = "before_model" | "after_model" | "after_tool" | "generic";

export type NeMoGuardrailConfig = {
  id: string;
  name: string;
  rawConfig: string;
  placement: NeMoPlacement;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
};
