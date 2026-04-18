import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Home() {
  const { user, loading, login, logout, realmRoles } = useAuth();

  if (loading) return <p>Loading…</p>;

  if (!user) {
    return (
      <div>
        <h1>Enterprise AI Platform</h1>
        <p>Sign in with Keycloak to continue.</p>
        <button type="button" onClick={() => void login()}>
          Login
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1>Enterprise AI Platform</h1>
      <p>
        Signed in as <strong>{user.profile.preferred_username ?? user.profile.name}</strong>
      </p>
      <p>Roles: {[...realmRoles].join(", ") || "(none in token)"}</p>
      <nav style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        <Link to="/chat">Chat</Link>
        {(realmRoles.has("builder") || realmRoles.has("admin") || realmRoles.has("platform-admin")) && (
          <Link to="/studio">Studio</Link>
        )}
        {(realmRoles.has("admin") || realmRoles.has("platform-admin")) && <Link to="/admin">Admin</Link>}
      </nav>
      <p style={{ marginTop: "2rem" }}>
        <button type="button" onClick={() => void logout()}>
          Logout
        </button>
      </p>
    </div>
  );
}
