import { useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { EmptyState } from "../components/EmptyState";
import { useFlash } from "../components/FlashContext";
import { PageChrome } from "../components/PageChrome";
import type { WorkflowDef } from "../data/workflows";
import { createWorkflow, deleteCustomWorkflow, isCustomWorkflow, type CustomWorkflow } from "../lib/workflowStorage";
import { notifyWorkflowCatalogChanged } from "../lib/workflowCatalog";
import { useWorkflowCatalog } from "../lib/useWorkflowCatalog";

type CatalogWf = WorkflowDef | CustomWorkflow;

export default function WorkflowsPage() {
  const { user, realmRoles } = useAuth();
  const { showSuccess } = useFlash();
  const navigate = useNavigate();
  const workflows = useWorkflowCatalog();
  const username = user?.profile.preferred_username ?? user?.sub ?? "";
  const isAdmin = realmRoles.has("admin") || realmRoles.has("platform-admin");
  const canSeeApiKeys =
    realmRoles.has("api_access") || realmRoles.has("admin") || realmRoles.has("platform-admin");

  const onCreate = () => {
    const w = createWorkflow(username, "Untitled workflow", "");
    notifyWorkflowCatalogChanged();
    showSuccess("Workflow created — add agents on the canvas.");
    navigate(`/workflows/${w.id}`);
  };

  const onDelete = (id: string) => {
    if (
      !window.confirm(
        canSeeApiKeys
          ? "Remove this workflow? API keys for this id will stop resolving under API access."
          : "Remove this workflow? It will disappear from Chat and the catalog.",
      )
    )
      return;
    if (deleteCustomWorkflow(id, username, isAdmin)) {
      notifyWorkflowCatalogChanged();
      showSuccess("Workflow removed.");
    }
  };

  return (
    <PageChrome
      title="Workflow"
      description="Pick a workflow to open the canvas, or create one and drag agents into a sequence. Everything is stored in this browser."
      actions={
        <button
          type="button"
          onClick={onCreate}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          Create workflow
        </button>
      }
    >
      {workflows.length === 0 ? (
        <div className="mt-2 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50/60">
          <EmptyState
            visual="workflow"
            title="No workflows in the catalog"
            description="The catalog is empty. That should be rare — try refreshing. You can still create a new workflow."
            action={
              <button
                type="button"
                onClick={onCreate}
                className="rounded-md bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800"
              >
                Create workflow
              </button>
            }
          />
        </div>
      ) : (
        <ul className="mt-2 space-y-3">
          {workflows.map((w: CatalogWf) => {
            const custom = isCustomWorkflow(w);
            return (
              <li key={w.id} className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-stretch">
                  <button
                    type="button"
                    onClick={() => navigate(`/workflows/${w.id}`)}
                    className="min-w-0 flex-1 p-4 text-left transition hover:bg-neutral-50/80"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-neutral-900">{w.name}</span>
                      {custom ? (
                        <span className="rounded border border-neutral-900 bg-neutral-900 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                          Yours
                        </span>
                      ) : (
                        <span className="rounded border border-neutral-300 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
                          System
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-neutral-600">{w.description}</p>
                    {custom ? (
                      <p className="mt-1 text-xs text-neutral-500">
                        {w.flowSteps.length} step{w.flowSteps.length === 1 ? "" : "s"} · created by {w.createdBy}
                      </p>
                    ) : null}
                    <p className="mt-2 text-xs font-medium text-neutral-500">Open to edit the flow →</p>
                  </button>
                  <div className="flex shrink-0 flex-col justify-center gap-2 border-t border-neutral-200 bg-neutral-50/80 px-4 py-3 sm:border-l sm:border-t-0 sm:items-end">
                    <code className="rounded bg-neutral-100 px-2 py-1 text-xs text-neutral-800">{w.id}</code>
                    {custom && (isAdmin || w.createdBy === username) ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(w.id);
                        }}
                        className="text-xs font-medium text-red-700 underline"
                      >
                        Delete
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </PageChrome>
  );
}
