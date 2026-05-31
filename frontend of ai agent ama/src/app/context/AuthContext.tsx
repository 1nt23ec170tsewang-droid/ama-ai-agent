import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail,
  confirmPasswordReset,
  updateProfile,
  onIdTokenChanged,
  signInWithPopup,
  GoogleAuthProvider,
  FacebookAuthProvider,
  OAuthProvider,
  sendEmailVerification
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../utils/firebase';
import { API_BASE, setActiveToken } from '../utils/config';
import { useToast } from './ToastContext';
import { saveAuthSession, readAuthSession, clearAuthSession } from '../utils/pwaAuth';

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
  authReady: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; unverified?: boolean }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string; unverified?: boolean }>;
  logout: () => Promise<void>;
  verifyEmail: (email: string, code: string) => Promise<{ success: boolean; error?: string }>;
  resendVerification: (email: string) => Promise<{ success: boolean; error?: string }>;
  forgotPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  resetPassword: (password: string, token: string, email: string) => Promise<{ success: boolean; error?: string }>;
  updatePhotoURL: (url: string) => Promise<void>;
  loginWithProvider: (providerName: 'google' | 'facebook' | 'linkedin') => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [tokenState, setTokenState] = useState<string | null>(() => localStorage.getItem('ama_token') || localStorage.getItem('authToken'));
  const [loading, setLoading] = useState<boolean>(true);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const { showToast } = useToast();

  const setToken = (t: string | null) => {
    setTokenState(t);
    setActiveToken(t);
    if (t) {
      localStorage.setItem('authToken', t);
      localStorage.setItem('ama_token', t);
    } else {
      localStorage.removeItem('authToken');
      localStorage.removeItem('ama_token');
    }
  };

  // ── REST Auth Fallback Profile Method ──────────────────────────────────────
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

  // ── PWA-Resilient Token Refresh Method ─────────────────────────────────────
  const silentRefreshFallback = async () => {
    // Read from IndexedDB / localStorage session (Fix 4)
    const session = await readAuthSession();
    const savedToken = session?.token || localStorage.getItem('ama_token') || localStorage.getItem('authToken');
    const savedRefreshToken = session?.refreshToken || localStorage.getItem('ama_refresh_token');

    try {
      const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: savedRefreshToken }),
        credentials: 'include'
      });

      if (res.ok) {
        const data = await res.json();
        const freshToken = data.token || data.accessToken;
        const freshRefreshToken = data.refreshToken || savedRefreshToken || '';
        setToken(freshToken);
        setUser(data.user);

        // Update IndexedDB persistent session (Fix 4)
        try {
          const expiry = Date.now() + 7 * 24 * 60 * 60 * 1000;
          await saveAuthSession(freshToken, freshRefreshToken, data.user, expiry);
        } catch (e) {
          console.warn('Silent refresh saveAuthSession failed:', e);
        }

        return freshToken;
      }

      if (res.status === 401) {
        // Explicit invalid token/session expired -> clean all credentials
        console.warn('Session expired (401 response). Logging out.');
        await clearAuthSession();
        setToken(null);
        setUser(null);
        return null;
      }

      // Other server error (e.g. 500, 503, etc.) - retain existing tokens/user for offline support
      if (session) {
        setToken(session.token);
        setUser(session.user);
        return session.token;
      }
      return null;
    } catch (networkError) {
      // Network offline or timeout - preserve current cached session, do NOT log out
      console.warn('Network error during silent refresh fallback. Retaining active session.', networkError);
      if (session) {
        setToken(session.token);
        setUser(session.user);
        return session.token;
      }
      return null;
    }
  };

  // ── Authentication Startup & Synchronization (Fix 4) ──────────────────────
  useEffect(() => {
    const startupSessionRestore = async () => {
      try {
        const session = await readAuthSession();
        if (session) {
          setTokenState(session.token);
          setActiveToken(session.token);
          setUser(session.user);
        } else {
          // Legacy cache fallback
          const savedToken = localStorage.getItem('authToken');
          const storedUser = localStorage.getItem('ama_user_cache');
          if (savedToken && storedUser) {
            setTokenState(savedToken);
            setActiveToken(savedToken);
            try { setUser(JSON.parse(storedUser)); } catch {}
          }
        }
      } catch (err) {
        console.warn('IndexedDB restoration failed during startup:', err);
      } finally {
        setAuthReady(true);
      }
    };

    startupSessionRestore();
  }, []);

  useEffect(() => {
    if (!authReady) return; // Wait for initial IndexedDB read before setting up listeners

    if (auth) {
      // Firebase Path
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

            // Sync to IndexedDB PWA session storage
            try {
              const expiry = Date.now() + 7 * 24 * 60 * 60 * 1000;
              await saveAuthSession(token, firebaseUser.refreshToken || '', userData, expiry);
            } catch (pwaErr) {
              console.warn('PWA sync error:', pwaErr);
            }

            try { localStorage.setItem('ama_user_cache', JSON.stringify(userData)); } catch {}
          } catch (tokenErr) {
            console.error('Firebase Auth session refresh failed:', tokenErr);
            showToast('Your session has expired. Please log in again.', 'error');
            await clearAuthSession();
            setToken(null);
            setUser(null);
          }
        } else {
          await clearAuthSession();
          setToken(null);
          setUser(null);
        }
        setLoading(false);
      });

      return () => unsubscribe();
    } else {
      // Express REST Path
      let refreshInterval: any;

      const initRestAuth = async () => {
        setLoading(true);
        const activeToken = await silentRefreshFallback();
        
        if (activeToken) {
          refreshInterval = setInterval(async () => {
            await silentRefreshFallback();
          }, 14 * 60 * 1000);
        }
        setLoading(false);
      };

      initRestAuth();

      return () => {
        if (refreshInterval) clearInterval(refreshInterval);
      };
    }
  }, [authReady, showToast]);

  // ── Authentication Actions ──────────────────────────────────────────────────
  const register = async (name: string, email: string, password: string) => {
    if (auth) {
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const firebaseUser = userCredential.user;

        // Send verification email immediately after registration
        await sendEmailVerification(firebaseUser, {
          url: 'https://ama-frontend-8efz.onrender.com/dashboard',
          handleCodeInApp: false
        });

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

        const tokenVal = data.token || data.accessToken;
        setToken(tokenVal);
        setUser(data.user);

        // Save session (Fix 4)
        try {
          const expiry = Date.now() + 7 * 24 * 60 * 60 * 1000;
          await saveAuthSession(tokenVal, data.refreshToken || '', data.user, expiry);
        } catch (e) {
          console.warn('Register session save failed:', e);
        }

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
      try {
        const res = await fetch(`${API_BASE}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.toLowerCase().trim(), password }),
          credentials: 'include'
        });
        const data = await res.json();

        if (res.ok) {
          const tokenVal = data.token || data.accessToken;
          setToken(tokenVal);
          setUser(data.user);

          // Save session (Fix 4)
          try {
            const expiry = Date.now() + 7 * 24 * 60 * 60 * 1000;
            await saveAuthSession(tokenVal, data.refreshToken || '', data.user, expiry);
          } catch (e) {
            console.warn('Login session save failed:', e);
          }

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
    try {
      await clearAuthSession();
    } catch (e) {
      console.warn('clearAuthSession failed during logout:', e);
    }
    
    if (auth) {
      try {
        await signOut(auth);
      } catch (err) {
        console.error('Firebase logout error:', err);
      }
    } else {
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
    if (user?.id) {
      if (db) {
        try {
          await updateDoc(doc(db, 'users', user.id), { photoURL: url });
        } catch (err) {
          console.error('Failed to update photoURL in Firestore:', err);
        }
      } else {
        try {
          await fetch(`${API_BASE}/api/auth/profile`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              ...(tokenState ? { Authorization: `Bearer ${tokenState}` } : {})
            },
            body: JSON.stringify({ name: user.name, photoURL: url })
          });
        } catch (err) {
          console.error('Failed to sync photoURL to backend:', err);
        }
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

    // Sync to IndexedDB session
    try {
      const session = await readAuthSession();
      if (session && session.user) {
        session.user.photoURL = url;
        await saveAuthSession(session.token, session.refreshToken, session.user, session.expiry);
      }
    } catch {}
  }, [user?.id, tokenState, user?.name]);

  const verifyEmail = async (email: string, code: string) => {
    if (auth) {
      return { success: true };
    } else {
      try {
        const res = await fetch(`${API_BASE}/api/auth/verify-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.toLowerCase().trim(), code }),
          credentials: 'include'
        });
        const data = await res.json();
        if (res.ok) {
          const tokenVal = data.token || data.accessToken;
          setToken(tokenVal);
          setUser(data.user);

          // Save session
          try {
            const expiry = Date.now() + 7 * 24 * 60 * 60 * 1000;
            await saveAuthSession(tokenVal, data.refreshToken || '', data.user, expiry);
          } catch (e) {
            console.warn('Verify email saveAuthSession failed:', e);
          }

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
      try {
        if (auth.currentUser) {
          await sendEmailVerification(auth.currentUser, {
            url: 'https://ama-frontend-8efz.onrender.com/dashboard',
            handleCodeInApp: false
          });
          return { success: true };
        }
        return { success: false, error: 'No active user found to resend verification. Please sign in again.' };
      } catch (err: any) {
        console.error('Firebase resend error:', err);
        return { success: false, error: err.message || 'Failed to resend verification.' };
      }
    } else {
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

  const loginWithProvider = async (providerName: 'google' | 'facebook' | 'linkedin') => {
    if (auth) {
      try {
        let provider: any;
        if (providerName === 'google') {
          provider = new GoogleAuthProvider();
        } else if (providerName === 'facebook') {
          provider = new FacebookAuthProvider();
        } else {
          provider = new OAuthProvider('oidc.linkedin');
        }
        await signInWithPopup(auth, provider);
        return { success: true };
      } catch (err: any) {
        console.error(`${providerName} auth error:`, err);
        return { success: false, error: err.message || `${providerName} login failed.` };
      }
    } else {
      try {
        showToast(`Simulating ${providerName} login...`, 'info');
        const mockEmail = `social.${providerName}@example.com`;
        const mockName = `${providerName.charAt(0).toUpperCase() + providerName.slice(1)} User`;
        const mockPassword = `OauthFallbackPass123!_${providerName}`;
        
        const loginRes = await fetch(`${API_BASE}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: mockEmail, password: mockPassword }),
          credentials: 'include'
        });
        
        if (loginRes.ok) {
          const loginData = await loginRes.json();
          const tokenVal = loginData.token || loginData.accessToken;
          setToken(tokenVal);
          setUser(loginData.user);

          // Save PWA session
          try {
            const expiry = Date.now() + 7 * 24 * 60 * 60 * 1000;
            await saveAuthSession(tokenVal, loginData.refreshToken || '', loginData.user, expiry);
          } catch (e) {
            console.warn('OAuth fallback saveAuthSession failed:', e);
          }

          return { success: true };
        }
        
        const regRes = await fetch(`${API_BASE}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            name: mockName, 
            email: mockEmail, 
            password: mockPassword 
          }),
          credentials: 'include'
        });
        
        if (regRes.ok) {
          const loginRes2 = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: mockEmail, password: mockPassword }),
            credentials: 'include'
          });
          if (loginRes2.ok) {
            const loginData2 = await loginRes2.json();
            const tokenVal2 = loginData2.token || loginData2.accessToken;
            setToken(tokenVal2);
            setUser(loginData2.user);

            // Save PWA session
            try {
              const expiry = Date.now() + 7 * 24 * 60 * 60 * 1000;
              await saveAuthSession(tokenVal2, loginData2.refreshToken || '', loginData2.user, expiry);
            } catch (e) {
              console.warn('OAuth fallback 2 saveAuthSession failed:', e);
            }

            return { success: true };
          }
        }
        
        const regData = await regRes.json().catch(() => ({}));
        return { success: false, error: regData.message || 'Social login fallback failed.' };
      } catch (err) {
        return { success: false, error: 'Cannot connect to authentication server.' };
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
      authReady,
      login,
      register,
      logout,
      verifyEmail,
      resendVerification,
      forgotPassword,
      resetPassword,
      updatePhotoURL,
      loginWithProvider
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
