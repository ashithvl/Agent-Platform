import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../api";

type Agent = { id: string; name: string; slug: string };

export default function Studio() {
  const { getAccessToken } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [slug, setSlug] = useState("my-agent");
  const [name, setName] = useState("My Agent");
  const [systemPrompt, setSystemPrompt] = useState("You are a helpful internal assistant.");
  const [model, setModel] = useState("gpt-4o-mini");
  const [selected, setSelected] = useState("");
  const [log, setLog] = useState<string[]>([]);

  const push = (m: string) => setLog((l) => [...l, m]);

  async function refresh() {
    const data = (await apiFetch("/workspaces/default/agents", getAccessToken())) as Agent[];
    setAgents(data);
    if (data[0] && !selected) setSelected(data[0].id);
  }

  useEffect(() => {
    void refresh().catch((e) => push(String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getAccessToken]);

  async function createAgent() {
    try {
      const a = (await apiFetch("/workspaces/default/agents", getAccessToken(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, name }),
      })) as Agent;
      push(`Created agent ${a.id}`);
      setSelected(a.id);
      await refresh();
    } catch (e) {
      push(String(e));
    }
  }

  async function saveVersion() {
    if (!selected) return;
    try {
      const v = await apiFetch(`/agents/${selected}/versions`, getAccessToken(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: { system_prompt: systemPrompt, model },
        }),
      });
      push(`Saved version: ${JSON.stringify(v)}`);
    } catch (e) {
      push(String(e));
    }
  }

  async function publish() {
    if (!selected) return;
    try {
      const p = await apiFetch(`/agents/${selected}/publish`, getAccessToken(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ env: "dev" }),
      });
      push(`Published: ${JSON.stringify(p)}`);
    } catch (e) {
      push(String(e));
    }
  }

  return (
    <div>
      <p>
        <Link to="/">Home</Link>
      </p>
      <h1>Studio</h1>
      <h2>Create agent</h2>
      <label>
        Slug <input value={slug} onChange={(e) => setSlug(e.target.value)} />
      </label>
      <label style={{ marginLeft: "1rem" }}>
        Name <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <button type="button" style={{ marginLeft: "1rem" }} onClick={() => void createAgent()}>
        Create
      </button>
      <h2>Edit / publish</h2>
      <label>
        Agent{" "}
        <select value={selected} onChange={(e) => setSelected(e.target.value)}>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>
      <div style={{ marginTop: "1rem" }}>
        <label>
          System prompt
          <textarea style={{ display: "block", width: "100%" }} rows={4} value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} />
        </label>
      </div>
      <label style={{ display: "block", marginTop: "0.5rem" }}>
        Model <input value={model} onChange={(e) => setModel(e.target.value)} />
      </label>
      <div style={{ marginTop: "0.5rem" }}>
        <button type="button" onClick={() => void saveVersion()}>
          Save version
        </button>
        <button type="button" style={{ marginLeft: "0.5rem" }} onClick={() => void publish()}>
          Publish (dev)
        </button>
      </div>
      <h3>Log</h3>
      <pre style={{ background: "#111", color: "#eee", padding: "1rem", maxHeight: 240, overflow: "auto" }}>
        {log.join("\n")}
      </pre>
    </div>
  );
}
