export type NavItem = {
  to: string;
  label: string;
  icon: "dash" | "agents" | "flow" | "api" | "book" | "wrench" | "layers" | "chat" | "settings" | "shield" | "chart";
  /** Any of these roles grants access; empty = any authenticated user */
  anyOf?: readonly string[];
};

export const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: "dash" },
  { to: "/agents", label: "Agents", icon: "agents", anyOf: ["builder", "admin", "platform-admin"] },
  { to: "/workflows", label: "Workflows", icon: "flow", anyOf: ["builder", "admin", "platform-admin"] },
  { to: "/api-access", label: "API access", icon: "api", anyOf: ["api_access", "admin", "platform-admin"] },
  { to: "/knowledge", label: "Knowledge hub", icon: "book", anyOf: ["builder", "admin", "platform-admin"] },
  { to: "/tools", label: "Tools", icon: "wrench", anyOf: ["builder", "admin", "platform-admin"] },
  { to: "/ingestion", label: "Data ingestion", icon: "layers", anyOf: ["builder", "admin", "platform-admin"] },
  { to: "/chat", label: "Chat", icon: "chat", anyOf: ["consumer", "builder", "admin", "platform-admin"] },
  { to: "/settings", label: "Settings", icon: "settings" },
  { to: "/guardrails", label: "Guardrails", icon: "shield", anyOf: ["admin", "platform-admin"] },
  { to: "/telemetry", label: "Telemetry", icon: "chart", anyOf: ["admin", "platform-admin"] },
];

export function navVisible(roles: Set<string>, item: NavItem): boolean {
  if (!item.anyOf?.length) return true;
  return item.anyOf.some((r) => roles.has(r));
}
