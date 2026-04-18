import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../api";

type Agent = { id: string; name: string; slug: string };

export default function Chat() {
  const { getAccessToken } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentId, setAgentId] = useState("");
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = (await apiFetch("/workspaces/default/agents", getAccessToken())) as Agent[];
        setAgents(data);
        if (data[0]) setAgentId(data[0].id);
      } catch (e) {
        setErr(String(e));
      }
    })();
  }, [getAccessToken]);

  async function send() {
    setErr(null);
    setReply(null);
    try {
      const data = (await apiFetch(`/agents/${agentId}/chat`, getAccessToken(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, env: "dev" }),
      })) as { reply?: string; error?: string; detail?: string };
      if (data.error) setReply(`Error: ${data.error} ${data.detail ?? ""}`);
      else setReply(data.reply ?? JSON.stringify(data));
    } catch (e) {
      setErr(String(e));
    }
  }

  return (
    <div>
      <p>
        <Link to="/">Home</Link>
      </p>
      <h1>Chat</h1>
      {err && <p style={{ color: "crimson" }}>{err}</p>}
      <label>
        Agent{" "}
        <select value={agentId} onChange={(e) => setAgentId(e.target.value)}>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.slug})
            </option>
          ))}
        </select>
      </label>
      <div style={{ marginTop: "1rem" }}>
        <textarea rows={4} style={{ width: "100%" }} value={message} onChange={(e) => setMessage(e.target.value)} />
      </div>
      <button type="button" style={{ marginTop: "0.5rem" }} onClick={() => void send()}>
        Send
      </button>
      {reply && (
        <pre style={{ marginTop: "1rem", whiteSpace: "pre-wrap" }}>
          {reply}
        </pre>
      )}
    </div>
  );
}
