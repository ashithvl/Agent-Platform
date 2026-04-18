export type NavGroup = "workspace" | "build" | "operate" | "admin";

export type NavItem = {
  to: string;
  label: string;
  icon: "dash" | "agents" | "flow" | "api" | "book" | "wrench" | "layers" | "chat" | "settings" | "shield" | "chart";
  group: NavGroup;
  /** Any of these roles grants access; empty = any authenticated user */
  anyOf?: readonly string[];
};

export const NAV_GROUPS: { id: NavGroup; label: string }[] = [
  { id: "workspace", label: "Workspace" },
  { id: "build", label: "Build" },
  { id: "operate", label: "Operate" },
  { id: "admin", label: "Admin" },
];

export const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: "dash", group: "workspace" },
  { to: "/chat", label: "Chat", icon: "chat", group: "workspace", anyOf: ["consumer", "builder", "admin", "platform-admin"] },

  { to: "/agents", label: "Agents", icon: "agents", group: "build", anyOf: ["builder", "admin", "platform-admin"] },
  { to: "/workflows", label: "Workflow", icon: "flow", group: "build", anyOf: ["builder", "admin", "platform-admin"] },
  { to: "/tools", label: "Tools", icon: "wrench", group: "build", anyOf: ["builder", "admin", "platform-admin"] },
  { to: "/knowledge", label: "Knowledge", icon: "book", group: "build", anyOf: ["builder", "admin", "platform-admin"] },
  { to: "/ingestion", label: "Data ingestion", icon: "layers", group: "build", anyOf: ["builder", "admin", "platform-admin"] },

  { to: "/telemetry", label: "Telemetry", icon: "chart", group: "operate" },
  { to: "/api-access", label: "API access", icon: "api", group: "operate", anyOf: ["api_access", "admin", "platform-admin"] },

  { to: "/guardrails", label: "Guardrails", icon: "shield", group: "admin", anyOf: ["admin", "platform-admin"] },
  { to: "/settings", label: "Settings", icon: "settings", group: "admin", anyOf: ["admin", "platform-admin"] },
];

export function navVisible(roles: Set<string>, item: NavItem): boolean {
  if (!item.anyOf?.length) return true;
  return item.anyOf.some((r) => roles.has(r));
}
