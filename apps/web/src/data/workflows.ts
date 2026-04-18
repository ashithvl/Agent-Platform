export type WorkflowDef = {
  id: string;
  name: string;
  description: string;
};

export const WORKFLOWS: WorkflowDef[] = [
  {
    id: "wf-support",
    name: "Customer Support",
    description: "Ticket triage, policy answers, and escalation hints.",
  },
  {
    id: "wf-research",
    name: "Research Assistant",
    description: "Summaries, citations-style answers, and structured briefs.",
  },
  {
    id: "wf-code",
    name: "Code Review",
    description: "Diff-aware explanations and secure coding suggestions.",
  },
  {
    id: "wf-ops",
    name: "Ops Copilot",
    description: "Runbooks, incident notes, and metric interpretation.",
  },
];

export function workflowById(id: string | undefined): WorkflowDef | undefined {
  return WORKFLOWS.find((w) => w.id === id);
}
