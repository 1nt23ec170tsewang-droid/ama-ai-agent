import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

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

export function SettingsProvider({ children, userEmail, userName }: {
  children: ReactNode;
  userEmail?: string;
  userName?: string;
}) {
  const [profile, setProfile] = useState<ProfileData>(() =>
    load('ama_profile', {
      name: userName || '',
      email: userEmail || '',
      phone: '',
      role: '',
      company: '',
      location: '',
      bio: '',
    })
  );

  const [notifications, setNotifications] = useState<NotificationSettings>(() =>
    load('ama_notifications', {
      emailNotifications: true,
      pushNotifications: true,
      dailySummary: false,
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

  // Seed name/email from auth on first load only (don't overwrite saved profile)
  useEffect(() => {
    setProfile(prev => ({
      ...prev,
      name: prev.name || userName || '',
      email: prev.email || userEmail || '',
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally run only once

  // Persist settings
  useEffect(() => { save('ama_profile', profile); }, [profile]);
  useEffect(() => { save('ama_notifications', notifications); }, [notifications]);
  useEffect(() => { save('ama_ai_settings', aiSettings); }, [aiSettings]);
  useEffect(() => { save('ama_appearance', appearance); }, [appearance]);
  useEffect(() => { save('ama_security', security); }, [security]);

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

  // ── Updaters ─────────────────────────────────────────────────────────────────
  const updateProfile = useCallback((data: Partial<ProfileData>) => {
    setProfile(prev => ({ ...prev, ...data }));
  }, []);
  const updateNotifications = useCallback((data: Partial<NotificationSettings>) => {
    setNotifications(prev => ({ ...prev, ...data }));
  }, []);
  const updateAISettings = useCallback((data: Partial<AISettings>) => {
    setAISettings(prev => ({ ...prev, ...data }));
  }, []);
  const updateAppearance = useCallback((data: Partial<AppearanceSettings>) => {
    setAppearance(prev => ({ ...prev, ...data }));
  }, []);
  const updateSecurity = useCallback((data: Partial<SecuritySettings>) => {
    setSecurity(prev => ({ ...prev, ...data }));
  }, []);

  return (
    <SettingsContext.Provider value={{
      profile, updateProfile,
      notifications, updateNotifications,
      aiSettings, updateAISettings,
      appearance, updateAppearance,
      security, updateSecurity,
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
