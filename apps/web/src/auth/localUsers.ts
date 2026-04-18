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

/** Demo realm roles. Admin gets full access; developer/user share builder capabilities. */
const ROLE_SET: Record<CreatableRole, string[]> = {
  user: ["consumer", "builder"],
  developer: ["consumer", "builder"],
  admin: ["platform-admin", "admin", "consumer", "builder"],
};

/** Canonical demo accounts — always three: admin, developer, user (see `ensureCanonicalSeeds`). */
const SEED: StoredUser[] = [
  { username: "admin", password: "admin", roles: [...ROLE_SET.admin] },
  { username: "developer", password: "developer", roles: [...ROLE_SET.developer] },
  { username: "user", password: "user", roles: [...ROLE_SET.user] },
];

function migrateLegacyRoles(users: StoredUser[]): StoredUser[] {
  let changed = false;
  const next = users.map((u) => {
    const name = u.username.toLowerCase();
    let roles = u.roles;
    let userChanged = false;
    if (roles.includes("api_access")) {
      roles = roles.filter((r) => r !== "api_access");
      userChanged = true;
    }
    if (name === "user" && roles.length === 1 && roles[0] === "consumer") {
      roles = [...ROLE_SET.user];
      userChanged = true;
    }
    if (name === "developer") {
      const want = [...ROLE_SET.developer];
      const same =
        roles.length === want.length && want.every((r) => roles.includes(r)) && roles.every((r) => want.includes(r));
      if (!same) {
        roles = want;
        userChanged = true;
      }
    }
    if (name === "admin" && (roles.includes("admin") || roles.includes("platform-admin"))) {
      const missing = !roles.includes("builder") || !roles.includes("consumer");
      if (missing) {
        roles = [...new Set([...roles, ...ROLE_SET.admin])];
        userChanged = true;
      }
    }
    if (!userChanged) return u;
    changed = true;
    return { ...u, roles };
  });
  if (changed) {
    saveUsers(next);
  }
  return next;
}

/** Ensures admin, developer, and user accounts exist with canonical roles (demo invariant). */
function ensureCanonicalSeeds(users: StoredUser[]): { users: StoredUser[]; changed: boolean } {
  const map = new Map<string, StoredUser>();
  for (const u of users) {
    map.set(u.username.toLowerCase(), u);
  }
  let changed = false;
  for (const seed of SEED) {
    const key = seed.username.toLowerCase();
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...seed });
      changed = true;
      continue;
    }
    const want = seed.roles;
    const same =
      existing.roles.length === want.length &&
      want.every((r) => existing.roles.includes(r)) &&
      existing.roles.every((r) => want.includes(r));
    if (!same) {
      map.set(key, { ...existing, roles: [...want] });
      changed = true;
    }
  }
  return { users: Array.from(map.values()), changed };
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
    const migrated = migrateLegacyRoles(parsed);
    const { users: merged, changed: seedChanged } = ensureCanonicalSeeds(migrated);
    if (seedChanged) {
      saveUsers(merged);
    }
    return merged;
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
    label: roleLabel(x.username, x.roles),
  }));
}

/** Display label; developer vs end-user share the same realm roles, so we use the canonical username. */
export function roleLabel(username: string, roles: string[]): string {
  if (roles.includes("platform-admin") || roles.includes("admin")) return "Admin";
  if (username.toLowerCase() === "developer") return "Developer";
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
