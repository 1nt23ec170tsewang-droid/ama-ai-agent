import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, Shield, Palette, Globe, Zap, Camera,
  Mail, Phone, MapPin, Building, Edit2, Save, X, Sun, Moon, Monitor, LogOut
} from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../utils/config';

// ── Toggle switch component ─────────────────────────────────────────────────
function Toggle({
  checked,
  onChange,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  id: string;
}) {
  return (
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 ${
        checked ? 'bg-orange-500' : 'bg-slate-300'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

// ── Theme button ─────────────────────────────────────────────────────────────
function ThemeBtn({
  value,
  current,
  label,
  icon,
  onClick,
}: {
  value: string;
  current: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  const active = value === current;
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all w-full ${
        active
          ? 'border-orange-500 bg-orange-50 text-orange-700'
          : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      {icon}
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export function SettingsView() {
  const {
    profile, updateProfile,
    notifications, updateNotifications,
    aiSettings, updateAISettings,
    appearance, updateAppearance,
    security, updateSecurity,
    privacy, updatePrivacy,
    clearAllHistory,
  } = useSettings();

  const { tasks, events } = useApp();
  const { logout, token } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const [gmailEmail, setGmailEmail] = useState<string | null>(() => localStorage.getItem('ama_gmail_email'));
  const [calendarConnected, setCalendarConnected] = useState<boolean>(() => localStorage.getItem('ama_calendar_connected') === 'true');
  const [slackConnected, setSlackConnected] = useState<boolean>(() => localStorage.getItem('ama_slack_connected') === 'true');

  const handleConnectGmail = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/gmail/auth`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      const data = await res.json();
      if (data.url) {
        // showToast('Opening Google sign-in…', 'info');
        window.location.href = data.url;
      }
    } catch {
      // showToast('Could not reach backend. Is it running?', 'error');
    }
  };

  const handleDisconnectGmail = () => {
    localStorage.removeItem('ama_gmail_email');
    setGmailEmail(null);
    // showToast('Gmail disconnected', 'info');
  };

  const integrations = [
    {
      name: 'Gmail',
      icon: '📧',
      bg: 'bg-blue-100',
      connected: !!gmailEmail,
      subtitle: gmailEmail || 'Not connected',
      onConnect: handleConnectGmail,
      onDisconnect: handleDisconnectGmail,
    },
    {
      name: 'Google Calendar',
      icon: '📅',
      bg: 'bg-purple-100',
      connected: calendarConnected,
      subtitle: calendarConnected ? 'Connected via Google' : 'Not connected',
      onConnect: () => {
        localStorage.setItem('ama_calendar_connected', 'true');
        setCalendarConnected(true);
        // We trigger the same OAuth flow to grant Calendar scopes
        handleConnectGmail();
      },
      onDisconnect: () => {
        localStorage.removeItem('ama_calendar_connected');
        setCalendarConnected(false);
        // showToast('Google Calendar disconnected', 'info');
      },
    },
    {
      name: 'Slack',
      icon: '💬',
      bg: 'bg-green-100',
      connected: slackConnected,
      subtitle: slackConnected ? 'Connected to workspace' : 'Not connected',
      onConnect: () => {
        localStorage.setItem('ama_slack_connected', 'true');
        setSlackConnected(true);
        // showToast('Slack connected!', 'success');
      },
      onDisconnect: () => {
        localStorage.removeItem('ama_slack_connected');
        setSlackConnected(false);
        // showToast('Slack disconnected', 'info');
      },
    },
    {
      name: 'WhatsApp',
      icon: '📞',
      bg: 'bg-green-500',
      connected: !!profile.phone,
      subtitle: profile.phone ? `Connected to ${profile.phone}` : 'Not connected',
      onConnect: () => {
        // showToast('Please add your Phone number in the Profile section above to connect WhatsApp.', 'info');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      onDisconnect: () => {
        updateProfile({ ...profile, phone: '' });
        // showToast('WhatsApp disconnected (Phone removed)', 'info');
      },
    },
  ];

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [draft, setDraft] = useState({ ...profile });

  useEffect(() => {
    if (!isEditingProfile) {
      setDraft({ ...profile });
    }
  }, [profile, isEditingProfile]);

  const handleEditStart = () => {
    setDraft({ ...profile });
    setIsEditingProfile(true);
  };

  const handleSave = () => {
    updateProfile(draft);
    setIsEditingProfile(false);
    // showToast('Profile saved successfully!', 'success');
  };

  const handleCancel = () => {
    setDraft({ ...profile });
    setIsEditingProfile(false);
  };

  const handleImageUpload = (type: 'avatar' | 'banner', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = type === 'avatar' ? 200 : 800;
        
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
          if (isEditingProfile) {
            setDraft(prev => ({ ...prev, [type]: compressedBase64 }));
            // showToast(`${type === 'avatar' ? 'Profile picture' : 'Banner'} preview updated!`, 'success');
          } else {
            updateProfile({ [type]: compressedBase64 });
            // showToast(`${type === 'avatar' ? 'Profile picture' : 'Banner'} updated!`, 'success');
          }
        }
      };
      img.src = URL.createObjectURL(file);
    }
  };

  const handleNotificationToggle = (key: keyof typeof notifications, val: boolean) => {
    if (key === 'pushNotifications' && val) {
      if ('Notification' in window) {
        Notification.requestPermission().then(perm => {
          if (perm === 'granted') {
            updateNotifications({ pushNotifications: true });
            new Notification('Push notifications enabled!', { body: 'Ama will notify you of important events.' });
          } else {
            // showToast('Push notification permission denied', 'error');
            updateNotifications({ pushNotifications: false });
          }
        });
        return;
      } else {
        // showToast('Push notifications not supported on this device', 'error');
        return;
      }
    }
    updateNotifications({ [key]: val });
  };

  const initials = profile.name
    ? profile.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <div className="p-4 md:p-8 h-full overflow-auto bg-slate-50 dark:bg-slate-900">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-semibold mb-6 md:mb-8 text-slate-900 dark:text-slate-100">
          Profile &amp; Settings
        </h2>

        <div className="space-y-6">
          {/* ── Profile ───────────────────────────────────────────────────── */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            {/* Cover */}
            <div 
              className="h-32 bg-gradient-to-r from-orange-400 to-orange-600 relative bg-cover bg-center"
              style={profile.banner ? { backgroundImage: `url(${profile.banner})` } : {}}
            >
            </div>

            <div className="p-6 md:p-8">
              <div className="flex flex-col md:flex-row gap-6 mb-6">
                {/* Avatar */}
                <div className="relative -mt-20 md:-mt-16">
                  <div className="w-28 h-28 md:w-32 md:h-32 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl border-4 border-white shadow-lg flex items-center justify-center overflow-hidden bg-cover bg-center"
                       style={(isEditingProfile ? draft.avatar : profile.avatar) ? { backgroundImage: `url(${isEditingProfile ? draft.avatar : profile.avatar})` } : {}}>
                    {!(isEditingProfile ? draft.avatar : profile.avatar) && <span className="text-4xl md:text-5xl text-white font-bold">{initials}</span>}
                  </div>
                </div>

                {/* Details / Edit form */}
                <div className="flex-1 md:pt-12">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-1">
                        {profile.name || 'Your Name'}
                      </h3>
                      <p className="text-orange-600 font-medium mb-2">{profile.role || 'Your Role'}</p>
                    </div>
                    {!isEditingProfile ? (
                      <button
                        onClick={handleEditStart}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg transition-colors text-sm"
                      >
                        <Edit2 className="w-4 h-4" />
                        Edit Profile
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={handleSave}
                          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-lg transition-colors text-sm"
                        >
                          <Save className="w-4 h-4" />
                          Save
                        </button>
                        <button
                          onClick={handleCancel}
                          className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors text-sm"
                        >
                          <X className="w-4 h-4" />
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>

                  {!isEditingProfile ? (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                          <Mail className="w-4 h-4 text-slate-400" />
                          {profile.email || '—'}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                          <Phone className="w-4 h-4 text-slate-400" />
                          {profile.phone || '—'}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                          <Building className="w-4 h-4 text-slate-400" />
                          {profile.company || '—'}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                          <MapPin className="w-4 h-4 text-slate-400" />
                          {profile.location || '—'}
                        </div>
                      </div>
                      {profile.bio ? (
                        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{profile.bio}</p>
                      ) : (
                        <p className="text-sm text-slate-400 italic">No bio yet. Click Edit Profile to add one.</p>
                      )}
                    </>
                  ) : (
                    <div className="space-y-4">
                      <div className="mb-2 flex items-center gap-2">
                        <label className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg transition-colors text-sm cursor-pointer border border-slate-200 dark:border-slate-600">
                          <Camera className="w-4 h-4" />
                          Upload Display Picture
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload('avatar', e)} />
                        </label>
                        {draft.avatar && (
                          <button
                            onClick={() => setDraft(prev => ({ ...prev, avatar: '' }))}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors text-sm border border-red-200"
                          >
                            <X className="w-4 h-4" />
                            Remove Photo
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                          { label: 'Full Name', key: 'name', type: 'text' },
                          { label: 'Email', key: 'email', type: 'email' },
                          { label: 'Phone', key: 'phone', type: 'tel' },
                          { label: 'Role', key: 'role', type: 'text' },
                          { label: 'Company', key: 'company', type: 'text' },
                          { label: 'Location', key: 'location', type: 'text' },
                        ].map(({ label, key, type }) => (
                          <div key={key}>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                              {label}
                            </label>
                            <input
                              type={type}
                              value={draft[key as keyof typeof draft]}
                              onChange={e => setDraft({ ...draft, [key]: e.target.value })}
                              placeholder={`Enter your ${label.toLowerCase()}`}
                              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                            />
                          </div>
                        ))}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Bio
                        </label>
                        <textarea
                          value={draft.bio}
                          onChange={e => setDraft({ ...draft, bio: e.target.value })}
                          rows={3}
                          placeholder="Tell Ama a bit about yourself, your goals, and working style…"
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm resize-none bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t border-slate-200 dark:border-slate-700">
                {[
                  { label: 'Tasks Completed', value: tasks.filter(t => t.completed).length },
                  { label: 'Emails Managed', value: JSON.parse(localStorage.getItem('ama_emails') || '[]').length || 0 },
                  { label: 'Meetings Scheduled', value: events.length },
                  { label: 'Days Active', value: (() => {
                    let d = localStorage.getItem('ama_install_date');
                    if (!d) { d = new Date().toISOString(); localStorage.setItem('ama_install_date', d); }
                    return Math.max(1, Math.ceil((new Date().getTime() - new Date(d).getTime()) / 86400000));
                  })() },
                ].map(s => (
                  <div key={s.label} className="text-center">
                    <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{s.value}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Notifications ─────────────────────────────────────────────── */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 md:p-6">
            <div className="flex items-center gap-3 mb-4">
              <Bell className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Notifications</h3>
            </div>
            <div className="space-y-3">
              {([
                { label: 'Email notifications', key: 'emailNotifications' },
                { label: 'Push notifications', key: 'pushNotifications' },
                { label: 'Daily summary', key: 'dailySummary' },
              ] as const).map(({ label, key }) => (
                <div key={key} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                  <span className="text-sm text-slate-700 dark:text-slate-200">{label}</span>
                  <Toggle
                    id={`notif-${key}`}
                    checked={notifications[key as keyof typeof notifications]}
                    onChange={v => handleNotificationToggle(key as keyof typeof notifications, v)}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* ── AI Preferences ────────────────────────────────────────────── */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 md:p-6">
            <div className="flex items-center gap-3 mb-4">
              <Zap className="w-5 h-5 text-purple-600" />
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">AI Preferences</h3>
            </div>
            <div className="space-y-3">
              <div className="p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                <label className="block mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                  Communication style
                </label>
                <select
                  value={aiSettings.communicationStyle}
                  onChange={e =>
                    updateAISettings({ communicationStyle: e.target.value as 'Professional' | 'Casual' | 'Concise' })
                  }
                  className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  <option>Professional</option>
                  <option>Casual</option>
                  <option>Concise</option>
                </select>
              </div>
              {([
                { label: 'Proactive suggestions', key: 'proactiveSuggestions' },
                { label: 'Auto-schedule tasks', key: 'autoScheduleTasks' },
              ] as const).map(({ label, key }) => (
                <div key={key} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                  <span className="text-sm text-slate-700 dark:text-slate-200">{label}</span>
                  <Toggle
                    id={`ai-${key}`}
                    checked={aiSettings[key]}
                    onChange={v => updateAISettings({ [key]: v })}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* ── Appearance ────────────────────────────────────────────────── */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 md:p-6">
            <div className="flex items-center gap-3 mb-4">
              <Palette className="w-5 h-5 text-green-600" />
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Appearance</h3>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Theme</p>
              <div className="grid grid-cols-3 gap-3">
                <ThemeBtn
                  value="light"
                  current={appearance.theme}
                  label="Light"
                  icon={<Sun className="w-5 h-5" />}
                  onClick={() => updateAppearance({ theme: 'light' })}
                />
                <ThemeBtn
                  value="dark"
                  current={appearance.theme}
                  label="Dark"
                  icon={<Moon className="w-5 h-5" />}
                  onClick={() => updateAppearance({ theme: 'dark' })}
                />
                <ThemeBtn
                  value="auto"
                  current={appearance.theme}
                  label="System"
                  icon={<Monitor className="w-5 h-5" />}
                  onClick={() => updateAppearance({ theme: 'auto' })}
                />
              </div>
            </div>
          </div>

          {/* ── Privacy & Security ────────────────────────────────────────── */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 md:p-6">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-5 h-5 text-red-600" />
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Privacy &amp; Security</h3>
            </div>
            <div className="space-y-3">
              {([
                { label: 'Two-factor authentication', key: 'twoFactor', type: 'security' },
                { label: 'Session timeout', key: 'sessionTimeout', type: 'security' },
              ] as const).map(({ label, key, type }) => (
                <div key={key} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                  <span className="text-sm text-slate-700 dark:text-slate-200">{label}</span>
                  <Toggle
                    id={`sec-${key}`}
                    checked={type === 'security' ? security[key] : false}
                    onChange={v => type === 'security' ? updateSecurity({ [key]: v }) : null}
                  />
                </div>
              ))}
              <div className="border-t border-slate-200 dark:border-slate-600 pt-3 mt-3">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">Chat History Privacy</p>
                {([
                  { label: 'Incognito Mode', key: 'incognitoMode', desc: 'No chat history saved' },
                  { label: 'Hide History', key: 'hideHistory', desc: 'History stored but hidden' },
                  { label: 'Auto-delete History', key: 'autoDeleteHistory', desc: 'Clear after each session' },
                ] as const).map(({ label, key, desc }) => (
                  <div key={key} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700 rounded-lg mb-2">
                    <div>
                      <span className="text-sm text-slate-700 dark:text-slate-200 font-medium block">{label}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{desc}</span>
                    </div>
                    <Toggle
                      id={`priv-${key}`}
                      checked={privacy[key]}
                      onChange={v => updatePrivacy({ [key]: v })}
                    />
                  </div>
                ))}
                <button
                  onClick={() => {
                    if (window.confirm('Permanently delete all chat history?')) {
                      clearAllHistory();
                      // showToast('All chat history deleted', 'success');
                    }
                  }}
                  className="w-full mt-3 py-2 px-4 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors border border-red-200 dark:border-red-900/30"
                >
                  Clear All History Permanently
                </button>
              </div>
            </div>
          </div>



          {/* ── Integrations ──────────────────────────────────────────────── */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 md:p-6">
            <div className="flex items-center gap-3 mb-4">
              <Globe className="w-5 h-5 text-orange-600" />
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Integrations</h3>
            </div>
            <div className="space-y-3">
              {integrations.map(({ name, icon, bg, connected, subtitle, onConnect, onDisconnect }) => (
                <div
                  key={name}
                  className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 ${bg} rounded-lg flex items-center justify-center`}>
                      <span className="text-lg">{icon}</span>
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-100 text-sm">{name}</p>
                      <div className="flex items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-slate-300'}`} />
                        <p className={`text-xs ${connected ? 'text-green-700 dark:text-green-400' : 'text-slate-500 dark:text-slate-400'}`}>
                          {subtitle}
                        </p>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={connected ? onDisconnect : onConnect}
                    className={`px-3 md:px-4 py-2 text-xs md:text-sm rounded-lg transition-colors ${
                      connected
                        ? 'bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-200'
                        : 'bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700'
                    }`}
                  >
                    {connected ? 'Disconnect' : 'Connect'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* ── Logout ────────────────────────────────────────────────────── */}
          <div className="pt-8 pb-4 flex justify-center">
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-6 py-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-all font-semibold shadow-sm hover:shadow"
            >
              <LogOut className="w-5 h-5" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
