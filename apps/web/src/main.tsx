import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App";
import { AuthProvider } from "./auth/AuthContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { FlashProvider } from "./components/FlashContext";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <FlashProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </FlashProvider>
      </ErrorBoundary>
    </BrowserRouter>
  </React.StrictMode>,
);
