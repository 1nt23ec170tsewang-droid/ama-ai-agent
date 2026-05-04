import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000';

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
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('authToken'));

  useEffect(() => {
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const register = async (name: string, email: string, password: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.message || 'Registration failed' };

      setUser(data.user);
      setToken(data.token);
      localStorage.setItem('currentUser', JSON.stringify(data.user));
      localStorage.setItem('authToken', data.token);
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
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (res.ok) {
        // Backend login succeeded — use real JWT
        setUser(data.user);
        setToken(data.token);
        localStorage.setItem('currentUser', JSON.stringify(data.user));
        localStorage.setItem('authToken', data.token);
        return { success: true };
      }

      // Backend doesn't know this user yet — try localStorage fallback
      // (for accounts created before the backend auth was connected)
      const localUsers: any[] = JSON.parse(localStorage.getItem('users') || '[]');
      const found = localUsers.find((u: any) => u.email === email && u.password === password);
      if (found) {
        const userData: User = { email: found.email, name: found.name };
        setUser(userData);
        // No real JWT — set null token; chat will still work via optionalAuth
        setToken(null);
        localStorage.setItem('currentUser', JSON.stringify(userData));
        localStorage.removeItem('authToken');

        // Auto-register them on the backend silently so future logins work
        fetch(`${API_BASE}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: found.name, email: found.email, password: found.password }),
        }).then(async r => {
          if (r.ok) {
            const d = await r.json();
            setToken(d.token);
            localStorage.setItem('authToken', d.token);
            localStorage.setItem('currentUser', JSON.stringify(d.user));
          }
        }).catch(() => {/* silent */});

        return { success: true };
      }

      return { success: false, error: data.message || 'Invalid email or password.' };
    } catch {
      // Backend unreachable — fall back to localStorage entirely
      const localUsers: any[] = JSON.parse(localStorage.getItem('users') || '[]');
      const found = localUsers.find((u: any) => u.email === email && u.password === password);
      if (found) {
        const userData: User = { email: found.email, name: found.name };
        setUser(userData);
        setToken(null);
        localStorage.setItem('currentUser', JSON.stringify(userData));
        return { success: true };
      }
      return { success: false, error: 'Cannot connect to server and no local account found.' };
    }
  };


  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('currentUser');
    localStorage.removeItem('authToken');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout }}>
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
