import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail,
  confirmPasswordReset,
  updateProfile,
  onIdTokenChanged
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../utils/firebase';
import { API_BASE, setActiveToken } from '../utils/config';
import { useToast } from './ToastContext';

interface User {
  id?: string;
  email: string;
  name: string;
  company?: string;
  role?: string;
  photoURL?: string;
}

interface AuthContextType {
  user: User | null | undefined;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; unverified?: boolean }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string; unverified?: boolean }>;
  logout: () => Promise<void>;
  verifyEmail: (email: string, code: string) => Promise<{ success: boolean; error?: string }>;
  resendVerification: (email: string) => Promise<{ success: boolean; error?: string }>;
  forgotPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  resetPassword: (password: string, token: string, email: string) => Promise<{ success: boolean; error?: string }>;
  updatePhotoURL: (url: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [tokenState, setTokenState] = useState<string | null>(() => localStorage.getItem('authToken'));
  const [loading, setLoading] = useState<boolean>(true);
  const { showToast } = useToast();

  const setToken = (t: string | null) => {
    setTokenState(t);
    setActiveToken(t);
    if (t) {
      localStorage.setItem('authToken', t);
    } else {
      localStorage.removeItem('authToken');
    }
  };

  // ── Original REST Auth Fallback Methods ─────────────────────────────────────
  const fetchProfileFallback = async (accessToken: string) => {
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
        // Cache user for PWA offline recovery
        try { localStorage.setItem('ama_user_cache', JSON.stringify(data.user)); } catch {}
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const silentRefreshFallback = async () => {
    // First try to restore from saved token (works offline for PWA)
    const savedToken = localStorage.getItem('authToken');
    
    try {
      const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setToken(data.accessToken);
        await fetchProfileFallback(data.accessToken);
        return data.accessToken;
      }
      
      // Refresh failed - try the saved token
      if (savedToken) {
        const ok = await fetchProfileFallback(savedToken);
        if (ok) {
          setToken(savedToken);
          return savedToken;
        }

        // Even if validation/refresh fails (e.g., session expired or backend down),
        // we KEEP the cached PWA user session so the user remains logged in permanently
        // until they explicitly click the Logout button!
        const storedUser = localStorage.getItem('ama_user_cache');
        if (storedUser) {
          try {
            const parsed = JSON.parse(storedUser);
            setUser(parsed);
            setToken(savedToken);
            return savedToken;
          } catch {}
        }
      }
      
      // No token at all - clear state
      setToken(null);
      setUser(null);
      return null;
    } catch (networkError) {
      // Network error (offline / server unreachable) - preserve existing auth state
      // This is critical for PWA users to stay logged in when the backend is down
      if (savedToken) {
        const ok = await fetchProfileFallback(savedToken).catch(() => false);
        if (ok) {
          setToken(savedToken);
          return savedToken;
        }
        // Even if profile fetch fails, keep token in localStorage
        // The user can still use cached features of the PWA
        // We'll attempt profile via a minimal decode
        const storedUser = localStorage.getItem('ama_user_cache');
        if (storedUser) {
          try {
            const parsed = JSON.parse(storedUser);
            setUser(parsed);
            setToken(savedToken);
            return savedToken;
          } catch {}
        }
      }
      setToken(null);
      setUser(null);
      return null;
    }
  };

  // ── Authentication Synchronization Listener ──────────────────────────────────
  useEffect(() => {
    if (auth) {
      // Modern Path: Real-time Firebase Auth ID token listener
      const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          try {
            const token = await firebaseUser.getIdToken();
            setToken(token);

            let name = firebaseUser.displayName || firebaseUser.email || 'User';
            let company = '';
            let role = 'user';
            let photoURL = '';

            try {
              const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
              if (userDoc.exists()) {
                const data = userDoc.data();
                if (data.name) name = data.name;
                if (data.company) company = data.company;
                if (data.role) role = data.role;
                if (data.photoURL) photoURL = data.photoURL;
              } else {
                await setDoc(doc(db, 'users', firebaseUser.uid), {
                  uid: firebaseUser.uid,
                  name,
                  email: firebaseUser.email?.toLowerCase().trim() || '',
                  createdAt: new Date().toISOString()
                });
              }
            } catch (fsErr) {
              console.warn('Firestore profile fetch failed (using auth profile):', fsErr);
            }

            const userData = {
              id: firebaseUser.uid,
              email: firebaseUser.email || '',
              name,
              company,
              role,
              photoURL
            };
            setUser(userData);
            // Cache for PWA offline recovery
            try { localStorage.setItem('ama_user_cache', JSON.stringify(userData)); } catch {}
          } catch (tokenErr) {
            console.error('Firebase Auth session refresh failed:', tokenErr);
            showToast('Your session has expired. Please log in again.', 'error');
            setToken(null);
            setUser(null);
          }
        } else {
          setToken(null);
          setUser(null);
        }
        setLoading(false);
      });

      return () => unsubscribe();
    } else {
      // Fallback Path: Local Express REST Session engine
      let refreshInterval: any;

      const initAuth = async () => {
        setLoading(true);
        const activeToken = await silentRefreshFallback();
        
        if (activeToken) {
          refreshInterval = setInterval(async () => {
            await silentRefreshFallback();
          }, 14 * 60 * 1000);
        }
        setLoading(false);
      };

      initAuth();

      return () => {
        if (refreshInterval) clearInterval(refreshInterval);
      };
    }
  }, [showToast]);

  // ── Sign-up / Login Actions ────────────────────────────────────────────────
  const register = async (name: string, email: string, password: string) => {
    if (auth) {
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const firebaseUser = userCredential.user;

        await updateProfile(firebaseUser, { displayName: name });

        await setDoc(doc(db, 'users', firebaseUser.uid), {
          uid: firebaseUser.uid,
          name,
          email: email.toLowerCase().trim(),
          createdAt: new Date().toISOString(),
          role: 'user'
        });

        return { success: true };
      } catch (err: any) {
        console.error('Firebase registration error:', err);
        return { success: false, error: err.message || 'Registration failed.' };
      }
    } else {
      // Fallback to Express backend endpoint
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
    }
  };

  const login = async (email: string, password: string) => {
    if (auth) {
      try {
        await signInWithEmailAndPassword(auth, email, password);
        return { success: true };
      } catch (err: any) {
        console.error('Firebase login error:', err);
        return { success: false, error: err.message || 'Invalid email or password.' };
      }
    } else {
      // Fallback to Express backend endpoint
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
    }
  };

  const logout = async () => {
    // Explicit sign out: clear all localStorage and reset react auth state
    try {
      localStorage.clear();
    } catch {}
    if (auth) {
      try {
        await signOut(auth);
      } catch (err) {
        console.error('Firebase logout error:', err);
      }
    } else {
      // Fallback to Express backend endpoint
      try {
        await fetch(`${API_BASE}/api/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include'
        });
      } catch (err) {
        console.error('Logout request failed:', err);
      }
    }
    setUser(null);
    setToken(null);
  };

  const updatePhotoURL = useCallback(async (url: string) => {
    if (user?.id && db) {
      try {
        await updateDoc(doc(db, 'users', user.id), { photoURL: url });
      } catch (err) {
        console.error('Failed to update photoURL in Firestore:', err);
      }
    }
    setUser(prev => prev ? { ...prev, photoURL: url } : prev);
    // Update PWA cache
    try {
      const cached = localStorage.getItem('ama_user_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        parsed.photoURL = url;
        localStorage.setItem('ama_user_cache', JSON.stringify(parsed));
      }
    } catch {}
  }, [user?.id]);

  const verifyEmail = async (email: string, code: string) => {
    if (auth) {
      return { success: true };
    } else {
      // Fallback to Express backend endpoint
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
    }
  };

  const resendVerification = async (email: string) => {
    if (auth) {
      return { success: true };
    } else {
      // Fallback to Express backend endpoint
      try {
        const res = await fetch(`${API_BASE}/api/auth/resend-verification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.toLowerCase().trim() }),
          credentials: 'include'
        });
        if (res.ok) return { success: true };
        const data = await res.json();
        return { success: false, error: data.message || 'Failed to resend code.' };
      } catch {
        return { success: false, error: 'Cannot connect to server.' };
      }
    }
  };

  const forgotPassword = async (email: string) => {
    if (auth) {
      try {
        await sendPasswordResetEmail(auth, email);
        return { success: true };
      } catch (err: any) {
        console.error('Firebase forgot password error:', err);
        return { success: false, error: err.message || 'Failed to send password reset email.' };
      }
    } else {
      // Fallback to Express backend endpoint
      try {
        const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.toLowerCase().trim() })
        });
        if (res.ok) return { success: true };
        const data = await res.json();
        return { success: false, error: data.message || 'Request failed.' };
      } catch {
        return { success: false, error: 'Cannot connect to server.' };
      }
    }
  };

  const resetPassword = async (password: string, token: string, email: string) => {
    if (auth) {
      try {
        await confirmPasswordReset(auth, token, password);
        return { success: true };
      } catch (err: any) {
        console.error('Firebase reset password error:', err);
        return { success: false, error: err.message || 'Password reset failed.' };
      }
    } else {
      // Fallback to Express backend endpoint
      try {
        const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password, token, email: email.toLowerCase().trim() })
        });
        if (res.ok) return { success: true };
        const data = await res.json();
        return { success: false, error: data.message || 'Reset failed.' };
      } catch {
        return { success: false, error: 'Cannot connect to server.' };
      }
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
      resetPassword,
      updatePhotoURL
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
