/**
 * Demo-only auth: users and passwords live in localStorage (no server).
 * Do not use for production secrets.
 */

const USERS_KEY = "eai_local_users_v1";

export type StoredUser = {
  username: string;
  /** Plain text — demo only */
  password: string;
  roles: string[];
};

export type CreatableRole = "user" | "developer" | "admin";

/** Same workspace features as developers except API keys / API access nav (see `api_access`). */
const ROLE_SET: Record<CreatableRole, string[]> = {
  user: ["consumer", "builder"],
  developer: ["consumer", "builder", "api_access"],
  admin: ["platform-admin", "admin", "consumer", "builder", "api_access"],
};

/** Seeded accounts: admin (full), developer (workspace + API keys), user (workspace, no API keys). */
const SEED: StoredUser[] = [
  { username: "admin", password: "admin", roles: [...ROLE_SET.admin] },
  { username: "developer", password: "developer", roles: [...ROLE_SET.developer] },
  { username: "user", password: "user", roles: [...ROLE_SET.user] },
];

function migrateLegacyRoles(users: StoredUser[]): StoredUser[] {
  let changed = false;
  const next = users.map((u) => {
    const name = u.username.toLowerCase();
    // Old seed: consumer-only "user" → workspace without API
    if (name === "user" && u.roles.length === 1 && u.roles[0] === "consumer") {
      changed = true;
      return { ...u, roles: [...ROLE_SET.user] };
    }
    // Old seed: developer without api_access
    if (name === "developer" && u.roles.includes("builder") && !u.roles.includes("api_access")) {
      changed = true;
      return { ...u, roles: [...ROLE_SET.developer] };
    }
    // Old admin role set without api_access / builder
    if (name === "admin" && (u.roles.includes("admin") || u.roles.includes("platform-admin"))) {
      const missing =
        !u.roles.includes("api_access") ||
        !u.roles.includes("builder") ||
        !u.roles.includes("consumer");
      if (missing) {
        changed = true;
        return { ...u, roles: [...new Set([...u.roles, ...ROLE_SET.admin])] };
      }
    }
    return u;
  });
  if (changed) {
    saveUsers(next);
  }
  return next;
}

function loadUsers(): StoredUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) {
      localStorage.setItem(USERS_KEY, JSON.stringify(SEED));
      return [...SEED];
    }
    const parsed = JSON.parse(raw) as StoredUser[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.setItem(USERS_KEY, JSON.stringify(SEED));
      return [...SEED];
    }
    return migrateLegacyRoles(parsed);
  } catch {
    localStorage.setItem(USERS_KEY, JSON.stringify(SEED));
    return [...SEED];
  }
}

function saveUsers(users: StoredUser[]): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function b64url(obj: object): string {
  const s = JSON.stringify(obj);
  const b64 = btoa(s);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/** Minimal JWT-shaped string so `realmRolesFromAccessToken` works without a backend. */
export function buildDemoAccessToken(username: string, roles: string[]): string {
  const header = b64url({ alg: "none", typ: "JWT" });
  const payload = b64url({
    sub: username,
    preferred_username: username,
    realm_access: { roles },
  });
  return `${header}.${payload}.`;
}

export function loginLocal(username: string, password: string): string {
  const users = loadUsers();
  const u = username.trim();
  const found = users.find(
    (x) => x.username.toLowerCase() === u.toLowerCase() && x.password === password,
  );
  if (!found) throw new Error("Invalid username or password.");
  return buildDemoAccessToken(found.username, found.roles);
}

export function listUsersPublic(): { username: string; roles: string[]; label: string }[] {
  return loadUsers().map((x) => ({
    username: x.username,
    roles: x.roles,
    label: roleLabel(x.roles),
  }));
}

export function roleLabel(roles: string[]): string {
  if (roles.includes("platform-admin") || roles.includes("admin")) return "Admin";
  if (roles.includes("api_access")) return "Developer";
  return "User";
}

export function createLocalUser(
  actorRoles: Set<string>,
  username: string,
  password: string,
  role: CreatableRole,
): void {
  if (!actorRoles.has("admin") && !actorRoles.has("platform-admin")) {
    throw new Error("Only administrators can create users.");
  }
  const users = loadUsers();
  const u = username.trim();
  if (!u) throw new Error("Username is required.");
  if (!password) throw new Error("Password is required.");
  if (users.some((x) => x.username.toLowerCase() === u.toLowerCase())) {
    throw new Error("That username is already taken.");
  }
  users.push({ username: u, password, roles: [...ROLE_SET[role]] });
  saveUsers(users);
}
