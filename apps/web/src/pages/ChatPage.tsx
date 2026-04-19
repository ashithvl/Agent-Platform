import { type MouseEvent, useCallback, useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";

import type { WorkflowDef } from "../data/workflows";
import { AssistantMessageContent } from "../components/AssistantMessageContent";
import { EmptyState } from "../components/EmptyState";
import { PageChrome } from "../components/PageChrome";
import { AGENT_SPECS_CHANGED, listAgentSpecs } from "../lib/agentSpecStorage";
import {
  CONVERSATIONS_CHANGED,
  appendAssistantMessage,
  appendUserMessage,
  createConversation,
  deleteConversation,
  listConversations,
  type Conversation,
} from "../lib/chatStorage";
import { runChatCompletion, type ChatMessagePayload } from "../lib/executionClient";
import type { AgentSpec } from "../lib/specTypes";
import { useRemoteList } from "../lib/useRemoteList";
import { useWorkflowCatalog } from "../lib/useWorkflowCatalog";
import { isCustomWorkflow, type CustomWorkflow } from "../lib/workflowStorage";

function buildLlmMessages(conv: Conversation, systemPrompt: string | undefined): ChatMessagePayload[] {
  const history = conv.messages.map((m) => ({ role: m.role, content: m.content }));
  const sys = systemPrompt?.trim();
  if (sys) return [{ role: "system", content: sys }, ...history];
  return history;
}

function resolveChatContext(
  wf: WorkflowDef | CustomWorkflow,
  agents: AgentSpec[],
): { model: string; agentId: string; systemPrompt: string | undefined } {
  if (isCustomWorkflow(wf) && wf.flowSteps.length > 0) {
    const step = wf.flowSteps[0];
    const ag = agents.find((a) => a.id === step.agentId);
    const model =
      (step.modelOverride?.trim() && step.modelOverride.trim()) || ag?.model?.trim() || "gpt-4o-mini";
    return { model, agentId: step.agentId, systemPrompt: ag?.systemPrompt };
  }
  const fallback = agents.find((a) => a.status === "active") ?? agents[0];
  return {
    model: fallback?.model?.trim() || "gpt-4o-mini",
    agentId: fallback?.id ?? "",
    systemPrompt: fallback?.systemPrompt,
  };
}

export default function ChatPage() {
  const formId = useId();
  const workflows = useWorkflowCatalog();
  const conversations = useRemoteList(CONVERSATIONS_CHANGED, listConversations);
  const agents = useRemoteList(AGENT_SPECS_CHANGED, listAgentSpecs);
  const [workflowId, setWorkflowId] = useState(() => workflows[0]?.id ?? "");

  useEffect(() => {
    if (!workflowId && workflows[0]) {
      setWorkflowId(workflows[0].id);
      return;
    }
    if (workflowId && !workflows.some((w) => w.id === workflowId) && workflows[0]) {
      setWorkflowId(workflows[0].id);
    }
  }, [workflows, workflowId]);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeId && conversations[0]) setActiveId(conversations[0].id);
  }, [conversations, activeId]);

  useEffect(() => {
    if (activeId && !conversations.some((c) => c.id === activeId) && conversations[0]) {
      setActiveId(conversations[0].id);
    }
  }, [conversations, activeId]);

  const active: Conversation | undefined = activeId ? conversations.find((c) => c.id === activeId) : undefined;

  useEffect(() => {
    if (activeId && active) {
      setWorkflowId(active.workflowId);
    }
  }, [activeId, active]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [active?.messages.length, activeId, pending]);

  const startNew = useCallback(async () => {
    if (!workflowId) return;
    const wf = workflows.find((w) => w.id === workflowId);
    const title = wf?.name ?? "New conversation";
    const c = await createConversation(workflowId, title);
    setActiveId(c.id);
    setInput("");
  }, [workflowId, workflows]);

  const onSend = useCallback(async () => {
    const text = input.trim();
    if (!text || pending || !workflowId) return;
    const wf = workflows.find((w) => w.id === workflowId);
    if (!wf) return;

    setPending(true);
    setInput("");

    let conv = active;
    if (!conv) {
      conv = await createConversation(workflowId, wf.name);
      setActiveId(conv.id);
    }

    const { model, agentId, systemPrompt } = resolveChatContext(wf, agents);

    let afterUser: Conversation;
    try {
      afterUser = await appendUserMessage(conv, text);
    } catch {
      setPending(false);
      return;
    }
    try {
      const messages = buildLlmMessages(afterUser, systemPrompt);
      const reply = await runChatCompletion({
        workflowId,
        agentId,
        model,
        messages,
      });
      await appendAssistantMessage(afterUser, reply);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await appendAssistantMessage(afterUser, `**Error:** ${msg}`);
    } finally {
      setPending(false);
    }
  }, [active, agents, input, pending, workflowId, workflows]);

  const onSelectConv = useCallback((id: string) => {
    setActiveId(id);
  }, []);

  const onDeleteConv = useCallback(
    async (id: string, e: MouseEvent) => {
      e.stopPropagation();
      await deleteConversation(id);
      setActiveId((cur) => {
        if (cur !== id) return cur;
        const rest = conversations.filter((c) => c.id !== id);
        return rest[0]?.id ?? null;
      });
    },
    [conversations],
  );

  return (
    <PageChrome
      title="Chat"
      description="Workflow-backed threads. Conversations are stored per signed-in user; replies go through the execution service and LiteLLM."
    >
      {workflows.length === 0 ? (
        <div className="mt-4 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50/60">
          <EmptyState
            visual="workflow"
            title="No workflows in the catalog"
            description="Chat needs at least one workflow. Create one from Workflow in the sidebar, then pick it here for new threads."
            action={
              <Link
                to="/workflows"
                className="inline-flex rounded-md bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800"
              >
                Open workflow catalog
              </Link>
            }
          />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <div
            className="shrink-0 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-xs leading-relaxed text-neutral-700"
            role="note"
          >
            <span className="font-semibold text-neutral-900">Live:</span> Messages are sent to{" "}
            <code className="rounded bg-neutral-100 px-1">POST /api/v1/execute</code> using the first agent in the
            workflow (or your first active agent for built-in templates).
          </div>

          <div className="flex min-h-0 min-h-[min(420px,100%)] flex-1 flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm md:flex-row">
            <aside className="flex max-h-[40vh] w-full flex-col border-b border-neutral-200 bg-neutral-50 md:max-h-none md:max-w-[280px] md:border-b-0 md:border-r">
              <div className="border-b border-neutral-200 p-3">
                <button
                  type="button"
                  onClick={() => void startNew()}
                  className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
                >
                  New conversation
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Recent</p>
                {conversations.length === 0 ? (
                  <EmptyState
                    compact
                    visual="chat"
                    title="No conversations yet"
                    description="Threads you open or create show up here and persist on the server."
                    action={
                      <button
                        type="button"
                        onClick={() => void startNew()}
                        className="rounded-md bg-neutral-900 px-3 py-2 text-xs font-medium text-white hover:bg-neutral-800"
                      >
                        New conversation
                      </button>
                    }
                    className="!max-w-none px-1"
                  />
                ) : (
                  <ul className="space-y-1">
                    {conversations.map((c) => {
                      const wf = workflows.find((w) => w.id === c.workflowId);
                      const selected = c.id === activeId;
                      return (
                        <li key={c.id}>
                          <div
                            className={[
                              "flex items-start gap-1 rounded-md text-left text-sm",
                              selected ? "bg-neutral-900 text-white" : "text-neutral-800 hover:bg-neutral-200/60",
                            ].join(" ")}
                          >
                            <button type="button" onClick={() => onSelectConv(c.id)} className="min-w-0 flex-1 px-3 py-2 text-left">
                              <span className="line-clamp-2 font-medium">{c.title}</span>
                              <span className={`mt-0.5 block text-[11px] ${selected ? "text-neutral-300" : "text-neutral-500"}`}>
                                {wf?.name ?? c.workflowId}
                              </span>
                            </button>
                            <button
                              type="button"
                              title="Delete conversation"
                              aria-label={`Delete conversation: ${c.title}`}
                              onClick={(e) => void onDeleteConv(c.id, e)}
                              className={[
                                "shrink-0 rounded p-2 text-neutral-500 hover:text-neutral-900",
                                selected ? "text-neutral-300 hover:bg-white/10 hover:text-white" : "hover:bg-neutral-300/50",
                              ].join(" ")}
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={1.5}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </aside>

            <section className="flex min-w-0 flex-1 flex-col">
              <div className="border-b border-neutral-200 bg-white px-4 py-3">
                <label htmlFor={`${formId}-workflow`} className="block text-xs font-medium uppercase tracking-wide text-neutral-500">
                  Workflow
                </label>
                <select
                  id={`${formId}-workflow`}
                  className="mt-1 max-w-md rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
                  value={workflowId}
                  onChange={(e) => setWorkflowId(e.target.value)}
                >
                  {workflows.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-neutral-500">New messages use the selected workflow. Existing threads keep their workflow context.</p>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
                {!active ? (
                  <div className="flex h-full flex-col items-center justify-center text-center">
                    <p className="text-sm font-medium text-neutral-800">No conversation selected</p>
                    <p className="mt-1 max-w-sm text-sm text-neutral-600">
                      Pick a workflow above, type in the box below, or open a recent thread.
                    </p>
                    <button
                      type="button"
                      onClick={() => void startNew()}
                      className="mt-6 rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium hover:bg-neutral-50"
                    >
                      New empty thread
                    </button>
                  </div>
                ) : (
                  <div className="mx-auto max-w-3xl space-y-6">
                    {active.messages.length === 0 && !pending ? (
                      <EmptyState
                        compact
                        visual="chat"
                        title="No messages in this thread"
                        description="Send a first message using the box below."
                        className="!max-w-lg"
                      />
                    ) : null}
                    {active.messages.map((m) => (
                      <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div
                          className={[
                            "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm",
                            m.role === "user" ? "bg-neutral-900 text-white" : "border border-neutral-200 bg-white text-neutral-900",
                          ].join(" ")}
                        >
                          {m.role === "user" ? (
                            <pre className="whitespace-pre-wrap font-sans">{m.content}</pre>
                          ) : (
                            <AssistantMessageContent text={m.content} />
                          )}
                        </div>
                      </div>
                    ))}
                    {pending ? (
                      <div className="flex justify-start">
                        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
                          Thinking…
                        </div>
                      </div>
                    ) : null}
                    <div ref={bottomRef} />
                  </div>
                )}
              </div>

              <div className="border-t border-neutral-200 bg-white p-4">
                <div className="mx-auto flex max-w-3xl gap-2">
                  <label htmlFor={`${formId}-message`} className="sr-only">
                    Message
                  </label>
                  <textarea
                    id={`${formId}-message`}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={active ? "Message…" : "Type a message to start this workflow…"}
                    disabled={pending}
                    rows={2}
                    className="min-h-[44px] flex-1 resize-none rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 disabled:bg-neutral-100"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void onSend();
                      }
                    }}
                  />
                  <button
                    type="button"
                    disabled={pending || !input.trim() || !workflowId}
                    onClick={() => void onSend()}
                    className="h-[44px] shrink-0 self-end rounded-lg bg-neutral-900 px-4 text-sm font-medium text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Send
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>
      )}
    </PageChrome>
  );
}
