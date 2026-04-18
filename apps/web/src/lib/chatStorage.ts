import { workflowById } from "./workflowCatalog";

const KEY = "eai_chat_conversations_v1";

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

function loadAll(): Conversation[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const v = JSON.parse(raw) as Conversation[];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function saveAll(list: Conversation[]): void {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function listConversations(): Conversation[] {
  return loadAll().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function listConversationsByWorkflow(workflowId: string | null): Conversation[] {
  const all = listConversations();
  if (!workflowId) return all;
  return all.filter((c) => c.workflowId === workflowId).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getConversation(id: string): Conversation | undefined {
  return loadAll().find((c) => c.id === id);
}

function genId(): string {
  return `conv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function genMsgId(): string {
  return `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function createConversation(workflowId: string): Conversation {
  const wf = workflowById(workflowId);
  const conv: Conversation = {
    id: genId(),
    workflowId,
    title: wf ? `${wf.name}` : "New conversation",
    updatedAt: Date.now(),
    messages: [],
  };
  const list = loadAll();
  list.push(conv);
  saveAll(list);
  return conv;
}

export function appendUserMessage(convId: string, content: string): Conversation | null {
  const list = loadAll();
  const i = list.findIndex((c) => c.id === convId);
  if (i < 0) return null;
  const conv = list[i];
  const trimmed = content.trim();
  if (!trimmed) return conv;
  const msg: ChatMessage = { id: genMsgId(), role: "user", content: trimmed, ts: Date.now() };
  const messages = [...conv.messages, msg];
  const title =
    conv.messages.length === 0 ? (trimmed.length > 48 ? `${trimmed.slice(0, 48)}…` : trimmed) : conv.title;
  const next: Conversation = {
    ...conv,
    title,
    updatedAt: Date.now(),
    messages,
  };
  list[i] = next;
  saveAll(list);
  return next;
}

export function appendAssistantMessage(convId: string, content: string): Conversation | null {
  const list = loadAll();
  const i = list.findIndex((c) => c.id === convId);
  if (i < 0) return null;
  const conv = list[i];
  const msg: ChatMessage = { id: genMsgId(), role: "assistant", content, ts: Date.now() };
  list[i] = { ...conv, messages: [...conv.messages, msg], updatedAt: Date.now() };
  saveAll(list);
  return list[i];
}

export function deleteConversation(convId: string): void {
  saveAll(loadAll().filter((c) => c.id !== convId));
}
