import { Navigate, Route, Routes } from "react-router-dom";

import NotFoundPage from "./pages/NotFoundPage";

import { RequireAuth } from "./auth/RequireAuth";
import { RoleRoute } from "./auth/RoleRoute";
import AppShell from "./layouts/AppShell";
import AgentsPage from "./pages/AgentsPage";
import ChatPage from "./pages/ChatPage";
import Dashboard from "./pages/Dashboard";
import DataIngestionPage from "./pages/DataIngestionPage";
import GuardrailsPage from "./pages/GuardrailsPage";
import KnowledgeHubPage from "./pages/KnowledgeHubPage";
import Login from "./pages/Login";
import RootRedirect from "./pages/RootRedirect";
import SettingsPage from "./pages/SettingsPage";
import TelemetryPage from "./pages/TelemetryPage";
import ToolsPage from "./pages/ToolsPage";
import WorkflowEditorPage from "./pages/WorkflowEditorPage";
import WorkflowsPage from "./pages/WorkflowsPage";

/** Workspace builder areas — agents, workflows, knowledge, tools, ingestion. */
const builderPlus = ["builder", "admin", "platform-admin"] as const;
const chatRoles = ["consumer", "builder", "admin", "platform-admin"] as const;
const adminPlus = ["admin", "platform-admin"] as const;

export default function App() {
  return (
    <div className="flex min-h-0 min-h-dvh flex-1 flex-col">
      <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<Login />} />
      <Route path="/admin" element={<Navigate to="/settings" replace />} />
      <Route path="/studio" element={<Navigate to="/workflows" replace />} />

      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<Dashboard />} />

          <Route
            path="/agents"
            element={
              <RoleRoute anyOf={[...builderPlus]}>
                <AgentsPage />
              </RoleRoute>
            }
          />
          <Route
            path="/workflows/:workflowId"
            element={
              <RoleRoute anyOf={[...builderPlus]}>
                <WorkflowEditorPage />
              </RoleRoute>
            }
          />
          <Route
            path="/workflows"
            element={
              <RoleRoute anyOf={[...builderPlus]}>
                <WorkflowsPage />
              </RoleRoute>
            }
          />
          <Route
            path="/knowledge"
            element={
              <RoleRoute anyOf={[...builderPlus]}>
                <KnowledgeHubPage />
              </RoleRoute>
            }
          />
          <Route
            path="/tools"
            element={
              <RoleRoute anyOf={[...builderPlus]}>
                <ToolsPage />
              </RoleRoute>
            }
          />
          <Route
            path="/ingestion"
            element={
              <RoleRoute anyOf={[...builderPlus]}>
                <DataIngestionPage />
              </RoleRoute>
            }
          />
          <Route
            path="/chat"
            element={
              <RoleRoute anyOf={[...chatRoles]}>
                <ChatPage />
              </RoleRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <RoleRoute anyOf={[...adminPlus]}>
                <SettingsPage />
              </RoleRoute>
            }
          />
          <Route
            path="/guardrails"
            element={
              <RoleRoute anyOf={[...adminPlus]}>
                <GuardrailsPage />
              </RoleRoute>
            }
          />
          <Route path="/telemetry" element={<TelemetryPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    </div>
  );
}
