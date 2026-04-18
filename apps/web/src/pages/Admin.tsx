import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../api";

export default function Admin() {
  const { getAccessToken } = useAuth();
  const [summary, setSummary] = useState<unknown>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const s = await apiFetch("/admin/summary", getAccessToken());
        setSummary(s);
      } catch (e) {
        setErr(String(e));
      }
    })();
  }, [getAccessToken]);

  return (
    <div>
      <p>
        <Link to="/">Home</Link>
      </p>
      <h1>Admin</h1>
      <p>Keycloak admin console: http://localhost:8090 (admin / admin)</p>
      {err && <p style={{ color: "crimson" }}>{err}</p>}
      <pre>{JSON.stringify(summary, null, 2)}</pre>
    </div>
  );
}
