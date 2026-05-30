declare module '*.css';

import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import "./styles/index.css";
import App from "./app/App";
import Login from "./app/components/Login";
import Register from "./app/components/Register";
import ResetPassword from "./app/components/ResetPassword";
import LandingPage from "./app/components/LandingPage";
import RyveLogo from "./app/components/RyveLogo";
import { AuthProvider, useAuth } from "./app/context/AuthContext";
import { ToastProvider } from "./app/context/ToastContext";
import RyveSplashScreen from "./app/components/RyveSplashScreen";
import OAuthCallback from "./app/components/OAuthCallback";

// ── Global Error Boundary — prevents blank page on unhandled React errors ──────
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: '' };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error: String(error?.message || error) };
  }
  componentDidCatch(error: any, info: any) {
    console.error('🔴 App Error Boundary caught:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', background: '#09051d', display: 'flex',
          flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Inter, system-ui, sans-serif', padding: '24px', textAlign: 'center'
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16, marginBottom: 24,
            background: 'linear-gradient(135deg,#FF6B00,#ff9a4d)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28
          }}>⚡</div>
          <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 700, margin: '0 0 8px' }}>
            Something went wrong
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, maxWidth: 360, margin: '0 0 28px' }}>
            Ryve hit an unexpected error. Try refreshing the page — your data is safe.
          </p>
          <button
            onClick={() => { this.setState({ hasError: false, error: '' }); window.location.href = '/'; }}
            style={{
              padding: '12px 28px', background: '#FF6B00', color: '#fff',
              border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 14,
              cursor: 'pointer', marginRight: 12
            }}
          >
            Reload App
          </button>
          {this.state.error && (
            <details style={{ marginTop: 24, color: 'rgba(255,255,255,0.3)', fontSize: 11, maxWidth: 480 }}>
              <summary style={{ cursor: 'pointer' }}>Error details</summary>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', marginTop: 8 }}>
                {this.state.error}
              </pre>
            </details>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}


const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Failed to find the root element");
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => {
        console.log('PWA Service Worker registered successfully:', reg.scope);
        reg.update(); // Force checking for updates immediately on load
      })
      .catch(err => console.error('PWA Service Worker registration failed:', err));
  });
}

function LoadingSpinner() {
  return <RyveSplashScreen />;
}

function RootRedirect() {
  const { user, loading, authReady } = useAuth();
  const location = useLocation();
  const params = location.search;
  const hasGmailParam = params.includes('gmail_connected') || params.includes('gmail_error');

  if (!authReady) return <RyveSplashScreen />;

  if (hasGmailParam) {
    return <Navigate to={`/dashboard${params}`} replace />;
  }
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }
  return <LandingPage />;
}

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, loading, authReady } = useAuth();
  const location = useLocation();

  const hasGmailCallback = location.search.includes('gmail_connected') || location.search.includes('gmail_error');

  if (!authReady) {
    return <RyveSplashScreen />;
  }

  if (user === null || user === undefined) {
    if (hasGmailCallback) {
      const params = new URLSearchParams(location.search);
      const gEmail = params.get('gmail_connected');
      if (gEmail) {
        localStorage.setItem('ama_gmail_email', decodeURIComponent(gEmail));
      }
    }
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  if (allowedRoles && user.role && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<RootRedirect />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />

              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/dashboard" element={<ProtectedRoute><App /></ProtectedRoute>} />
              <Route path="/auth/callback/google" element={<OAuthCallback />} />
              <Route path="/auth/callback/facebook" element={<OAuthCallback />} />
              <Route path="/auth/callback/linkedin" element={<OAuthCallback />} />
              <Route path="/auth/callback" element={<Navigate to="/dashboard" replace />} />
              {/* Legacy /landing route redirects to root */}
              <Route path="/landing" element={<Navigate to="/" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  </React.StrictMode>
);