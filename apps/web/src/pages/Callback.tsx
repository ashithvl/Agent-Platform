import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserManager } from "oidc-client-ts";

import { buildOidcSettings } from "../auth/oidcSettings";

export default function Callback() {
  const navigate = useNavigate();
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const um = new UserManager(buildOidcSettings());
        await um.signinRedirectCallback();
        navigate("/", { replace: true });
      } catch (e) {
        setErr(String(e));
      }
    })();
  }, [navigate]);

  if (err) return <p>Login error: {err}</p>;
  return <p>Completing login…</p>;
}
