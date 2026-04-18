/** Global tool (MCP-style metadata; execution not in browser). */
export type ToolKind = "mcp" | "http" | "simple";

export type Tool = {
  id: string;
  name: string;
  kind: ToolKind;
  description: string;
  createdBy: string;
  createdAt: number;
  serverUrl?: string;
  transport?: string;
  headersJson?: string;
};

export type ContextStrategy = "passthrough" | "templated" | "from_previous_step";

/** LangChain-oriented agent definition (config only). */
export type AgentSpec = {
  id: string;
  name: string;
  model: string;
  systemPrompt: string;
  contextStrategy: ContextStrategy;
  contextNotes: string;
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
