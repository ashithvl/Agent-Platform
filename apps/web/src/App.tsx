import { Navigate, Route, Routes } from "react-router-dom";
import { RequireRole } from "./auth/RequireRole";
import Admin from "./pages/Admin";
import Callback from "./pages/Callback";
import Chat from "./pages/Chat";
import Home from "./pages/Home";
import Studio from "./pages/Studio";

export default function App() {
  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 900, margin: "0 auto", padding: "1rem" }}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/callback" element={<Callback />} />
        <Route
          path="/chat"
          element={
            <RequireRole anyOf={["consumer", "builder", "admin", "platform-admin"]}>
              <Chat />
            </RequireRole>
          }
        />
        <Route
          path="/studio"
          element={
            <RequireRole anyOf={["builder", "admin", "platform-admin"]}>
              <Studio />
            </RequireRole>
          }
        />
        <Route
          path="/admin"
          element={
            <RequireRole anyOf={["admin", "platform-admin"]}>
              <Admin />
            </RequireRole>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
