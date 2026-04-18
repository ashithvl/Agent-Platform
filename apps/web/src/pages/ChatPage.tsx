import { type MouseEvent, useCallback, useEffect, useRef, useState } from "react";

import { workflowById } from "../lib/workflowCatalog";
import { useWorkflowCatalog } from "../lib/useWorkflowCatalog";
import {
  appendAssistantMessage,
  appendUserMessage,
  createConversation,
  deleteConversation,
  getConversation,
  listConversations,
  type Conversation,
} from "../lib/chatStorage";

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function mockAssistantReply(workflowName: string, userMessage: string): Promise<string> {
  await delay(400 + Math.random() * 900);
  const snippet = userMessage.length > 320 ? `${userMessage.slice(0, 320)}…` : userMessage;
  return [
    `**${workflowName}**`,
    "",
    `Processing your message:`,
    "",
    snippet,
    "",
    "_Demo mode: responses are generated locally. Plug in an inference endpoint for live streams._",
  ].join("\n");
}

export default function ChatPage() {
  const workflows = useWorkflowCatalog();
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
  const [conversations, setConversations] = useState<Conversation[]>(() => listConversations());
  const [activeId, setActiveId] = useState<string | null>(() => {
    const list = listConversations();
    return list[0]?.id ?? null;
  });
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const active = activeId ? getConversation(activeId) : undefined;

  const refreshSidebar = useCallback(() => setConversations(listConversations()), []);

  useEffect(() => {
    if (activeId && active) {
      setWorkflowId(active.workflowId);
    }
  }, [activeId, active]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [active?.messages.length, activeId, pending]);

  const startNew = useCallback(() => {
    if (!workflowId) return;
    const c = createConversation(workflowId);
    refreshSidebar();
    setActiveId(c.id);
    setInput("");
  }, [workflowId, refreshSidebar]);

  const onSend = useCallback(async () => {
    const text = input.trim();
    if (!text || pending || !workflowId) return;
    const wf = workflowById(workflowId);
    if (!wf) return;

    setPending(true);
    setInput("");

    let cid = activeId;
    if (!cid) {
      const c = createConversation(workflowId);
      cid = c.id;
      setActiveId(cid);
    }

    appendUserMessage(cid, text);
    refreshSidebar();

    try {
      const reply = await mockAssistantReply(wf.name, text);
      appendAssistantMessage(cid, reply);
    } finally {
      setPending(false);
      refreshSidebar();
    }
  }, [activeId, input, pending, refreshSidebar, workflowId]);

  const onSelectConv = useCallback((id: string) => {
    setActiveId(id);
  }, []);

  const onDeleteConv = useCallback(
    (id: string, e: MouseEvent) => {
      e.stopPropagation();
      deleteConversation(id);
      refreshSidebar();
      setActiveId((cur) => {
        if (cur !== id) return cur;
        const next = listConversations()[0]?.id ?? null;
        return next;
      });
    },
    [refreshSidebar],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-950">
        Chat uses mock replies. Agent, pipeline, and RAG definitions are saved in the browser only — execution is not
        wired to LangChain or execution-service.
      </div>
      <div className="flex min-h-0 min-h-[480px] flex-1 flex-col md:flex-row">
        {/* Conversations */}
        <aside className="flex max-h-[40vh] w-full flex-col border-b border-neutral-200 bg-neutral-50 md:max-h-none md:max-w-[280px] md:border-b-0 md:border-r">
          <div className="border-b border-neutral-200 p-3">
            <button
              type="button"
              onClick={startNew}
              className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
            >
              New conversation
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Recent</p>
            <ul className="space-y-1">
              {conversations.map((c) => {
                const wf = workflowById(c.workflowId);
                const selected = c.id === activeId;
                return (
                  <li key={c.id}>
                    <div
                      className={[
                        "group flex items-start gap-1 rounded-md text-left text-sm",
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
                        title="Delete"
                        onClick={(e) => onDeleteConv(c.id, e)}
                        className={[
                          "shrink-0 rounded p-2 opacity-0 transition group-hover:opacity-100",
                          selected ? "hover:bg-white/10" : "hover:bg-neutral-300/50",
                        ].join(" ")}
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>

        {/* Thread */}
        <section className="flex min-w-0 flex-1 flex-col">
          <div className="border-b border-neutral-200 bg-white px-4 py-3">
            <label className="block text-xs font-medium uppercase tracking-wide text-neutral-500">Workflow</label>
            <select
              className="mt-1 max-w-md rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
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
                  Pick a workflow above, type in the box below, or open a recent thread. Everything is stored locally in this browser.
                </p>
                <button
                  type="button"
                  onClick={startNew}
                  className="mt-6 rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium hover:bg-neutral-50"
                >
                  New empty thread
                </button>
              </div>
            ) : (
              <div className="mx-auto max-w-3xl space-y-6">
                {active.messages.map((m) => (
                  <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={[
                        "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm",
                        m.role === "user" ? "bg-neutral-900 text-white" : "border border-neutral-200 bg-white text-neutral-900",
                      ].join(" ")}
                    >
                      <pre className="whitespace-pre-wrap font-sans">{m.content}</pre>
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
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={active ? "Message…" : "Type a message to start this workflow…"}
                disabled={pending}
                rows={2}
                className="min-h-[44px] flex-1 resize-none rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900 disabled:bg-neutral-100"
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
  );
}
