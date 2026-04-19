import { apiPost } from "./apiClient";

export type ChatMessagePayload = { role: string; content: string };

export type ExecuteResponse = {
  content: string;
  trace_id?: string | null;
  raw?: Record<string, unknown>;
};

export async function runChatCompletion(input: {
  workflowId: string;
  agentId?: string;
  model: string;
  messages: ChatMessagePayload[];
}): Promise<string> {
  const res = await apiPost<ExecuteResponse>("/api/v1/execute", {
    workflow_id: input.workflowId,
    agent_id: input.agentId ?? "",
    model: input.model,
    messages: input.messages,
  });
  return res.content?.trim() ? res.content : "(Empty model response.)";
}
