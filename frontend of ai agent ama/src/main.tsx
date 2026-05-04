import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router";
import App from "./app/App";
import Login from "./app/components/Login";
import Register from "./app/components/Register";
import { AuthProvider, useAuth } from "./app/context/AuthContext";
import "./styles/index.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Failed to find the root element");
}

/**
 * RootRedirect: handles the OAuth callback that Google sends back to /
 * If ?gmail_connected or ?gmail_error is in the URL, forward to /dashboard
 * with the params intact so EmailManager can pick them up.
 * Otherwise behave like the old catch-all (go to /login if not authed).
 */
function RootRedirect() {
  const { user } = useAuth();
  const location = useLocation();
  const params = location.search; // preserves ?gmail_connected=...
  const hasGmailParam = params.includes('gmail_connected') || params.includes('gmail_error');

  if (hasGmailParam) {
    // Always forward to /dashboard so EmailManager can read the param
    return <Navigate to={`/dashboard${params}`} replace />;
  }
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }
  return <Navigate to="/login" replace />;
}

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<App />} />
          <Route path="/auth/callback" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
);