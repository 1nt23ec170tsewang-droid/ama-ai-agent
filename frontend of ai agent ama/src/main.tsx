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


const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Failed to find the root element");
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('PWA Service Worker registered successfully:', reg.scope))
      .catch(err => console.error('PWA Service Worker registration failed:', err));
  });
}

function LoadingSpinner() {
  return (
    <div className="min-h-screen bg-[#030014] flex flex-col items-center justify-center text-white font-sans relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-slate-900 to-[#030014] z-0"></div>
      <div className="z-10 flex flex-col items-center space-y-4">
        <div className="animate-pulse">
          <RyveLogo size={64} variant="dark" />
        </div>
        <p className="text-orange-400 font-medium animate-pulse">Establishing Secure Session...</p>
      </div>
    </div>
  );
}

function RootRedirect() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const params = location.search;
  const hasGmailParam = params.includes('gmail_connected') || params.includes('gmail_error');

  if (loading) return <LoadingSpinner />;

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
  const { user, loading } = useAuth();
  const location = useLocation();

  const hasGmailCallback = location.search.includes('gmail_connected') || location.search.includes('gmail_error');

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!user) {
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
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/dashboard" element={<ProtectedRoute><App /></ProtectedRoute>} />
            <Route path="/auth/callback" element={<Navigate to="/dashboard" replace />} />
            {/* Legacy /landing route redirects to root */}
            <Route path="/landing" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  </React.StrictMode>
);