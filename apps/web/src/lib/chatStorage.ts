import { apiDelete, apiGet, apiSend } from "./apiClient";

export const CONVERSATIONS_CHANGED = "eai-conversations-changed";

function notify(): void {
  window.dispatchEvent(new CustomEvent(CONVERSATIONS_CHANGED));
}

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  ts: number;
};

export type Conversation = {
  id: string;
  workflowId: string;
  title: string;
  updatedAt: number;
  messages: ChatMessage[];
};

function normalizeConversation(raw: unknown): Conversation | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string") return null;
  const messagesRaw = r.messages;
  const messages: ChatMessage[] = Array.isArray(messagesRaw)
    ? (messagesRaw as Record<string, unknown>[])
        .map((m) => {
          if (!m || typeof m !== "object") return null;
          if (m.role !== "user" && m.role !== "assistant") return null;
          return {
            id: String(m.id ?? `msg_${Date.now()}`),
            role: m.role,
            content: String(m.content ?? ""),
            ts: typeof m.ts === "number" ? m.ts : Date.now(),
          };
        })
        .filter(Boolean) as ChatMessage[]
    : [];
  return {
    id: r.id,
    workflowId: typeof r.workflowId === "string" ? r.workflowId : "",
    title: typeof r.title === "string" ? r.title : "Conversation",
    updatedAt: typeof r.updatedAt === "number" ? r.updatedAt : Date.now(),
    messages,
  };
}

export async function listConversations(): Promise<Conversation[]> {
  const rows = await apiGet<unknown[]>("/api/v1/conversations");
  if (!Array.isArray(rows)) return [];
  return rows.map(normalizeConversation).filter(Boolean) as Conversation[];
}

function genId(): string {
  return `conv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function genMsgId(): string {
  return `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export async function createConversation(workflowId: string, title: string): Promise<Conversation> {
  const conv: Conversation = {
    id: genId(),
    workflowId,
    title,
    updatedAt: Date.now(),
    messages: [],
  };
  await apiSend<unknown>("PUT", "/api/v1/conversations", { id: conv.id, data: conv });
  notify();
  return conv;
}

export async function saveConversation(conv: Conversation): Promise<void> {
  await apiSend<unknown>("PUT", "/api/v1/conversations", { id: conv.id, data: conv });
  notify();
}

export async function appendUserMessage(conv: Conversation, content: string): Promise<Conversation> {
  const trimmed = content.trim();
  if (!trimmed) return conv;
  const msg: ChatMessage = { id: genMsgId(), role: "user", content: trimmed, ts: Date.now() };
  const messages = [...conv.messages, msg];
  const title =
    conv.messages.length === 0 ? (trimmed.length > 48 ? `${trimmed.slice(0, 48)}…` : trimmed) : conv.title;
  const next: Conversation = { ...conv, title, messages, updatedAt: Date.now() };
  await saveConversation(next);
  return next;
}

export async function appendAssistantMessage(conv: Conversation, content: string): Promise<Conversation> {
  const msg: ChatMessage = { id: genMsgId(), role: "assistant", content, ts: Date.now() };
  const next: Conversation = { ...conv, messages: [...conv.messages, msg], updatedAt: Date.now() };
  await saveConversation(next);
  return next;
}

export async function deleteConversation(id: string): Promise<void> {
  await apiDelete<unknown>(`/api/v1/conversations/${encodeURIComponent(id)}`);
  notify();
}
