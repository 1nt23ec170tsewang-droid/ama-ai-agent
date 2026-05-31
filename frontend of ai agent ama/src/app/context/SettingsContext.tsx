import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { API_BASE } from '../utils/config';

// ── Types ──────────────────────────────────────────────────────────────────────
export interface ProfileData {
  name: string;
  email: string;
  phone: string;
  role: string;
  company: string;
  location: string;
  bio: string;
  avatar?: string;
  banner?: string;
}

export interface NotificationSettings {
  emailNotifications: boolean;
  pushNotifications: boolean;
  dailySummary: boolean;
  taskReminders: boolean;
  overdueAlerts: boolean;
  emailAlerts: boolean;
  calendarReminders: boolean;
  morningBriefing: boolean;
  teamTaskAssignments: boolean;
}

export interface AISettings {
  communicationStyle: 'Professional' | 'Casual' | 'Concise';
  proactiveSuggestions: boolean;
  autoScheduleTasks: boolean;
}

export interface AppearanceSettings {
  theme: 'light' | 'dark' | 'auto';
}

export interface SecuritySettings {
  twoFactor: boolean;
  sessionTimeout: boolean;
}

export interface PrivacySettings {
  hideHistory: boolean;
  autoDeleteHistory: boolean;
  incognitoMode: boolean;
}

interface SettingsContextType {
  profile: ProfileData;
  updateProfile: (data: Partial<ProfileData>) => void;
  notifications: NotificationSettings;
  updateNotifications: (data: Partial<NotificationSettings>) => void;
  aiSettings: AISettings;
  updateAISettings: (data: Partial<AISettings>) => void;
  appearance: AppearanceSettings;
  updateAppearance: (data: Partial<AppearanceSettings>) => void;
  security: SecuritySettings;
  updateSecurity: (data: Partial<SecuritySettings>) => void;
  privacy: PrivacySettings;
  updatePrivacy: (data: Partial<PrivacySettings>) => void;
  clearAllHistory: () => void;
  isDark: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

// ── Context ───────────────────────────────────────────────────────────────────
const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children, userEmail, userName, userCompany, userRole }: {
  children: ReactNode;
  userEmail?: string;
  userName?: string;
  userCompany?: string;
  userRole?: string;
}) {
  const { token } = useAuth();

  const [profile, setProfile] = useState<ProfileData>(() =>
    load('ama_profile', {
      name: userName || '',
      email: userEmail || '',
      phone: '',
      role: userRole || '',
      company: userCompany || '',
      location: '',
      bio: '',
    })
  );

  const [notifications, setNotifications] = useState<NotificationSettings>(() =>
    load('ama_notifications', {
      emailNotifications: true,
      pushNotifications: true,
      dailySummary: false,
      taskReminders: true,
      overdueAlerts: true,
      emailAlerts: true,
      calendarReminders: true,
      morningBriefing: false,
      teamTaskAssignments: true
    })
  );

  const [aiSettings, setAISettings] = useState<AISettings>(() =>
    load('ama_ai_settings', {
      communicationStyle: 'Professional',
      proactiveSuggestions: true,
      autoScheduleTasks: false,
    })
  );

  const [appearance, setAppearance] = useState<AppearanceSettings>(() =>
    load('ama_appearance', { theme: 'light' })
  );

  const [security, setSecurity] = useState<SecuritySettings>(() =>
    load('ama_security', {
      twoFactor: true,
      sessionTimeout: false,
    })
  );

  const [privacy, setPrivacy] = useState<PrivacySettings>(() =>
    load('ama_privacy', {
      hideHistory: false,
      autoDeleteHistory: false,
      incognitoMode: false,
    })
  );

  // Dynamically sync profile details from active auth session
  useEffect(() => {
    setProfile(prev => {
      const updates: Partial<ProfileData> = {};
      if (userName && userName !== 'User' && prev.name !== userName) {
        updates.name = userName;
      }
      if (userEmail && userEmail !== 'user@example.com' && prev.email !== userEmail) {
        updates.email = userEmail;
      }
      if (userCompany && prev.company !== userCompany) {
        updates.company = userCompany;
      }
      if (userRole && prev.role !== userRole) {
        updates.role = userRole;
      }
      if (Object.keys(updates).length > 0) {
        return { ...prev, ...updates };
      }
      return prev;
    });
  }, [userName, userEmail, userCompany, userRole]);

  // Persist settings
  useEffect(() => { save('ama_profile', profile); }, [profile]);
  useEffect(() => { save('ama_notifications', notifications); }, [notifications]);
  useEffect(() => { save('ama_ai_settings', aiSettings); }, [aiSettings]);
  useEffect(() => { save('ama_appearance', appearance); }, [appearance]);
  useEffect(() => { save('ama_security', security); }, [security]);
  useEffect(() => { save('ama_privacy', privacy); }, [privacy]);

  // ── Dark mode: apply class to <html> ────────────────────────────────────────
  const isDark = appearance.theme === 'dark' ||
    (appearance.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  useEffect(() => {
    const root = document.documentElement;
    if (appearance.theme === 'auto') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const apply = (e: MediaQueryListEvent | MediaQueryList) => {
        root.classList.toggle('dark', e.matches);
      };
      apply(mq);
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    } else {
      root.classList.toggle('dark', appearance.theme === 'dark');
    }
  }, [appearance.theme]);

  // Sync notification settings from server when token becomes available
  useEffect(() => {
    if (!token) return;
    const fetchSettings = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/user/settings`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.settings) {
            setNotifications(prev => ({
              ...prev,
              ...data.settings
            }));
          }
        }
      } catch (err) {
        console.warn('Failed to load settings from server:', err);
      }
    };
    fetchSettings();
  }, [token]);

  // ── Updaters ─────────────────────────────────────────────────────────────────
  const updateProfile = useCallback((data: Partial<ProfileData>) => {
    setProfile(prev => ({ ...prev, ...data }));
  }, []);
  const updateNotifications = useCallback((data: Partial<NotificationSettings>) => {
    setNotifications(prev => {
      const updated = { ...prev, ...data };
      if (token) {
        fetch(`${API_BASE}/api/user/settings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ settings: updated })
        }).catch(err => console.warn('Failed to sync settings with server:', err));
      }
      return updated;
    });
  }, [token]);
  const updateAISettings = useCallback((data: Partial<AISettings>) => {
    setAISettings(prev => ({ ...prev, ...data }));
  }, []);
  const updateAppearance = useCallback((data: Partial<AppearanceSettings>) => {
    setAppearance(prev => ({ ...prev, ...data }));
  }, []);
  const updateSecurity = useCallback((data: Partial<SecuritySettings>) => {
    setSecurity(prev => ({ ...prev, ...data }));
  }, []);
  const updatePrivacy = useCallback((data: Partial<PrivacySettings>) => {
    setPrivacy(prev => ({ ...prev, ...data }));
  }, []);
  const clearAllHistory = useCallback(() => {
    localStorage.removeItem('ama_chat_sessions');
    window.dispatchEvent(new Event('ama_chat_sessions_updated'));
  }, []);

  return (
    <SettingsContext.Provider value={{
      profile, updateProfile,
      notifications, updateNotifications,
      aiSettings, updateAISettings,
      appearance, updateAppearance,
      security, updateSecurity,
      privacy, updatePrivacy,
      clearAllHistory,
      isDark,
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within a SettingsProvider');
  return ctx;
}
