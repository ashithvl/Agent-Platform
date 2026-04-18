const PREFIX = "eai_sk_live_";

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

/** Fake stable API key per workflow (demo only). */
export function apiKeyForWorkflow(wf: { id: string; name: string }): string {
  const core = simpleHash(wf.id + wf.name).padStart(8, "0").slice(0, 24);
  return `${PREFIX}${core}`;
}

export function mockInvokeUrl(workflowId: string, base: string): string {
  const b = base.replace(/\/$/, "");
  return `${b}/workflows/${workflowId}/invoke`;
}
