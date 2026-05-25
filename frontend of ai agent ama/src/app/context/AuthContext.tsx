import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { API_BASE, setActiveToken } from '../utils/config';

interface User {
  id?: string;
  email: string;
  name: string;
  company?: string;
  role?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; unverified?: boolean }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string; unverified?: boolean }>;
  logout: () => Promise<void>;
  verifyEmail: (email: string, code: string) => Promise<{ success: boolean; error?: string }>;
  resendVerification: (email: string) => Promise<{ success: boolean; error?: string }>;
  forgotPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  resetPassword: (password: string, token: string, email: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tokenState, setTokenState] = useState<string | null>(() => localStorage.getItem('authToken'));
  const [loading, setLoading] = useState<boolean>(true);

  const setToken = (t: string | null) => {
    setTokenState(t);
    setActiveToken(t);
    if (t) {
      localStorage.setItem('authToken', t);
    } else {
      localStorage.removeItem('authToken');
    }
  };

  // Helper to fetch user details using the short-lived access token
  const fetchProfile = async (accessToken: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  // Perform a silent refresh to get a new access token via HttpOnly refresh cookie
  const silentRefresh = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include' // CRITICAL: transport HttpOnly cookie
      });
      if (res.ok) {
        const data = await res.json();
        setToken(data.accessToken);
        await fetchProfile(data.accessToken);
        return data.accessToken;
      }
      
      const savedToken = localStorage.getItem('authToken');
      if (savedToken) {
        const ok = await fetchProfile(savedToken);
        if (ok) {
          setToken(savedToken);
          return savedToken;
        }
      }
      
      setToken(null);
      setUser(null);
      return null;
    } catch {
      const savedToken = localStorage.getItem('authToken');
      if (savedToken) {
        const ok = await fetchProfile(savedToken);
        if (ok) {
          setToken(savedToken);
          return savedToken;
        }
      }
      setToken(null);
      setUser(null);
      return null;
    }
  };

  useEffect(() => {
    let refreshInterval: any;

    const initAuth = async () => {
      setLoading(true);
      const activeToken = await silentRefresh();
      
      if (activeToken) {
        // Schedule refresh every 14 minutes (840,000 ms) before the 15m JWT expires
        refreshInterval = setInterval(async () => {
          await silentRefresh();
        }, 14 * 60 * 1000);
      }
      setLoading(false);
    };

    initAuth();

    return () => {
      if (refreshInterval) clearInterval(refreshInterval);
    };
  }, []);

  const register = async (name: string, email: string, password: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email: email.toLowerCase().trim(), password }),
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 403 && data.unverified) {
          return { success: false, unverified: true, error: data.message };
        }
        return { success: false, error: data.message || 'Registration failed' };
      }

      setToken(data.accessToken);
      setUser(data.user);
      return { success: true };
    } catch {
      return { success: false, error: 'Cannot connect to server. Is the backend running?' };
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase().trim(), password }),
        credentials: 'include'
      });
      const data = await res.json();

      if (res.ok) {
        setToken(data.accessToken);
        setUser(data.user);
        return { success: true };
      }

      if (res.status === 403 && data.unverified) {
        return { success: false, unverified: true, error: data.message || 'Email not verified.' };
      }

      return { success: false, error: data.message || 'Invalid email or password.' };
    } catch {
      return { success: false, error: 'Cannot connect to server.' };
    }
  };

  const logout = async () => {
    try {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
    } catch (err) {
      console.error('Logout request failed:', err);
    } finally {
      setUser(null);
      setToken(null);
    }
  };

  const verifyEmail = async (email: string, code: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase().trim(), code }),
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok) {
        setToken(data.accessToken);
        setUser(data.user);
        return { success: true };
      }
      return { success: false, error: data.message || 'Verification failed.' };
    } catch {
      return { success: false, error: 'Cannot connect to server.' };
    }
  };

  const resendVerification = async (email: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase().trim() }),
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok) return { success: true };
      return { success: false, error: data.message || 'Failed to resend code.' };
    } catch {
      return { success: false, error: 'Cannot connect to server.' };
    }
  };

  const forgotPassword = async (email: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase().trim() })
      });
      const data = await res.json();
      if (res.ok) return { success: true };
      return { success: false, error: data.message || 'Request failed.' };
    } catch {
      return { success: false, error: 'Cannot connect to server.' };
    }
  };

  const resetPassword = async (password: string, token: string, email: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, token, email: email.toLowerCase().trim() })
      });
      const data = await res.json();
      if (res.ok) return { success: true };
      return { success: false, error: data.message || 'Reset failed.' };
    } catch {
      return { success: false, error: 'Cannot connect to server.' };
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      token: tokenState,
      loading,
      login,
      register,
      logout,
      verifyEmail,
      resendVerification,
      forgotPassword,
      resetPassword
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
