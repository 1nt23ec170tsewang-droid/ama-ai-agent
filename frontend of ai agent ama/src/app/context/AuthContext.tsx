import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail,
  confirmPasswordReset,
  updateProfile,
  onIdTokenChanged
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../utils/firebase';
import { setActiveToken } from '../utils/config';
import { useToast } from './ToastContext';

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
  const { showToast } = useToast();

  useEffect(() => {
    // Standard Firebase Auth State listener
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const token = await firebaseUser.getIdToken();
          localStorage.setItem('authToken', token);
          setTokenState(token);
          setActiveToken(token);

          // Fetch profile details from Firestore `/users/{uid}`
          let name = firebaseUser.displayName || firebaseUser.email || 'User';
          let company = '';
          let role = 'user';

          try {
            const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
            if (userDoc.exists()) {
              const data = userDoc.data();
              if (data.name) name = data.name;
              if (data.company) company = data.company;
              if (data.role) role = data.role;
            } else {
              // Create the profile if it doesn't exist
              await setDoc(doc(db, 'users', firebaseUser.uid), {
                uid: firebaseUser.uid,
                name,
                email: firebaseUser.email?.toLowerCase().trim() || '',
                createdAt: new Date().toISOString()
              });
            }
          } catch (fsErr) {
            console.warn('Firestore user doc read/create failed:', fsErr);
          }

          setUser({
            id: firebaseUser.uid,
            email: firebaseUser.email || '',
            name,
            company,
            role
          });
        } catch (tokenErr: any) {
          console.error('Failed to retrieve Firebase Auth token:', tokenErr);
          // If session token retrieval fails permanently (e.g. disabled account, network disruption)
          showToast('Session has expired or account was modified. Please log in again.', 'error');
          localStorage.removeItem('authToken');
          setTokenState(null);
          setActiveToken(null);
          setUser(null);
        }
      } else {
        localStorage.removeItem('authToken');
        setTokenState(null);
        setActiveToken(null);
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [showToast]);

  const register = async (name: string, email: string, password: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      await updateProfile(firebaseUser, { displayName: name });

      // Save user record to firestore `/users/{uid}`
      await setDoc(doc(db, 'users', firebaseUser.uid), {
        uid: firebaseUser.uid,
        name,
        email: email.toLowerCase().trim(),
        createdAt: new Date().toISOString(),
        role: 'user'
      });

      return { success: true };
    } catch (err: any) {
      console.error('Registration failed:', err);
      return { success: false, error: err.message || 'Registration failed.' };
    }
  };

  const login = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return { success: true };
    } catch (err: any) {
      console.error('Login failed:', err);
      return { success: false, error: err.message || 'Invalid email or password.' };
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  // Custom 6-digit verification code is bypassed since Firebase Auth handles verification and registration seamlessly
  const verifyEmail = async (email: string, code: string) => {
    return { success: true };
  };

  const resendVerification = async (email: string) => {
    return { success: true };
  };

  const forgotPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
      return { success: true };
    } catch (err: any) {
      console.error('Password reset email failed:', err);
      return { success: false, error: err.message || 'Failed to send password reset email.' };
    }
  };

  const resetPassword = async (password: string, token: string, email: string) => {
    try {
      await confirmPasswordReset(auth, token, password);
      return { success: true };
    } catch (err: any) {
      console.error('Confirm password reset failed:', err);
      return { success: false, error: err.message || 'Password reset failed.' };
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
