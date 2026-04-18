const KEY = "eai_guardrails_v1";

export type GuardrailPolicy = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
};

const DEFAULTS: GuardrailPolicy[] = [
  {
    id: "pii",
    name: "Block PII export",
    description: "Prevent obvious SSN, card numbers, and national IDs in outputs.",
    enabled: true,
  },
  {
    id: "secrets",
    name: "No secrets in responses",
    description: "Strip API keys and PEM blocks from assistant text.",
    enabled: true,
  },
  {
    id: "toxicity",
    name: "Toxicity filter (input)",
    description: "Reject abusive user turns before they reach the model.",
    enabled: true,
  },
  {
    id: "urls",
    name: "Allowlist outbound URLs",
    description: "Only link to approved corporate domains in answers.",
    enabled: false,
  },
];

function load(): GuardrailPolicy[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      localStorage.setItem(KEY, JSON.stringify(DEFAULTS));
      return [...DEFAULTS];
    }
    const parsed = JSON.parse(raw) as GuardrailPolicy[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.setItem(KEY, JSON.stringify(DEFAULTS));
      return [...DEFAULTS];
    }
    return parsed;
  } catch {
    localStorage.setItem(KEY, JSON.stringify(DEFAULTS));
    return [...DEFAULTS];
  }
}

export function listGuardrails(): GuardrailPolicy[] {
  return load();
}

export function setGuardrailEnabled(id: string, enabled: boolean): void {
  const list = load();
  const next = list.map((p) => (p.id === id ? { ...p, enabled } : p));
  localStorage.setItem(KEY, JSON.stringify(next));
}
