declare module '*.css';

import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import "./styles/index.css";
import App from "./app/App";
import Login from "./app/components/Login";
import Register from "./app/components/Register";
import ResetPassword from "./app/components/ResetPassword";
import { AuthProvider, useAuth } from "./app/context/AuthContext";
import { ToastProvider } from "./app/context/ToastContext";


const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Failed to find the root element");
}

function RootRedirect() {
  const { user } = useAuth();
  const location = useLocation();
  const params = location.search;
  const hasGmailParam = params.includes('gmail_connected') || params.includes('gmail_error');

  if (hasGmailParam) {
    return <Navigate to={`/dashboard${params}`} replace />;
  }
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }
  return <Navigate to="/login" replace />;
}

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#030014] flex flex-col items-center justify-center text-white font-sans relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-slate-900 to-[#030014] z-0"></div>
        <div className="z-10 flex flex-col items-center space-y-4">
          <div className="w-16 h-16 border-t-4 border-b-4 border-indigo-500 rounded-full animate-spin"></div>
          <p className="text-indigo-400 font-medium animate-pulse">Establishing Secure Session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && user.role && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    {/* --- WRAP EVERYTHING IN TOASTPROVIDER --- */}
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/dashboard" element={<ProtectedRoute><App /></ProtectedRoute>} />
            <Route path="/auth/callback" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<RootRedirect />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
    {/* --------------------------------------- */}
  </React.StrictMode>
);