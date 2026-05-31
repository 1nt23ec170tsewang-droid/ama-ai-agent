import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ShieldCheck, ArrowLeft } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { ChatView } from './components/ChatView';
import { TasksView } from './components/TasksView';
import { CalendarView } from './components/CalendarView';
import { SettingsView } from './components/SettingsView';
import { EmailManager } from './components/EmailManager';
import { MorningBriefing } from './components/MorningBriefing';
import { WeeklyInsights } from './components/WeeklyInsights';
import { TeamManager } from './components/TeamManager';
import { AppProvider } from './context/AppContext';
import { useAuth } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import { QuickAskWidget } from './components/QuickAskWidget';
import RyveLogo from './components/RyveLogo';
import BottomNavBar from './components/BottomNavBar';
import { Avatar } from './components/ui/avatar';
import MoreBottomSheet from './components/MoreBottomSheet';
import { messaging } from './utils/firebase';
import { getToken, onMessage } from 'firebase/messaging';
import { API_BASE } from './utils/config';
import { useToast } from './context/ToastContext';

const getInitials = (name: string) => {
  if (!name) return 'U';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
};

export default function App() {
  const { user, token, verifyEmail, resendVerification } = useAuth();
  const { showToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState('briefing');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  // Register push notifications & listen for foreground notifications
  useEffect(() => {
    if (!user || !token || !messaging) return;

    const registerPush = async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          // Standard VAPID key placeholder or client parameter
          const fcmToken = await getToken(messaging, {
            vapidKey: 'BFd9-Jv8-aQ5_gT9sC_6OOpFk9Yp9vP7sV4_h3u7f6D8r_Y8zC5n_xT9mS8q8b5_d9_Jv8_aQ5_gT9sC_6OO'
          });

          if (fcmToken) {
            await fetch(`${API_BASE}/api/user/register-fcm`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({ token: fcmToken })
            });
            console.log('✅ FCM push token registered successfully:', fcmToken);
          }
        }
      } catch (err) {
        console.warn('⚠️ Could not register FCM push notifications:', err);
      }
    };

    registerPush();

    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('🚀 Foreground FCM message received:', payload);
      const title = payload.notification?.title || payload.data?.title || 'Ryve Notification';
      const body = payload.notification?.body || payload.data?.body || '';
      showToast(`${title}: ${body}`, 'info');
    });

    return () => unsubscribe();
  }, [user, token, showToast]);

  // Email verification dialog states
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationError, setVerificationError] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [verificationLoading, setVerificationLoading] = useState(false);

  const handleVerificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerificationError('');
    setVerificationLoading(true);
    if (verificationCode.length !== 6) {
      setVerificationError('Verification code must be exactly 6 digits.');
      setVerificationLoading(false);
      return;
    }
    const result = await verifyEmail(pendingEmail || user?.email || '', verificationCode);
    if (result.success) {
      setVerificationLoading(false);
      setIsVerifying(false);
      setVerificationCode('');
      if (user) {
        (user as any).emailVerified = true;
      }
      alert('Email successfully verified!');
      window.location.reload();
    } else {
      setVerificationLoading(false);
      setVerificationError(result.error || 'Invalid or expired verification code.');
    }
  };

  // Auto-switch based on tab query param or Gmail OAuth redirects
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab) {
      setActiveView(tab);
    } else if (params.get('gmail_connected') || params.get('gmail_error')) {
      setActiveView('email');
    } else {
      setActiveView('briefing');
    }
  }, [location.search]);

  const authenticatedUser = {
    name: user?.name || 'User',
    email: user?.email || 'user@example.com',
    initials: getInitials(user?.name || ''),
  };

  const handleViewChange = (view: string) => {
    const params = new URLSearchParams(location.search);
    params.set('tab', view);
    navigate(`/dashboard?${params.toString()}`);
    setSidebarOpen(false);
  };

  const renderView = () => {
    switch (activeView) {
      case 'briefing':  return <MorningBriefing />;
      case 'chat':      return <ChatView sidebarOpen={sidebarOpen} onCloseSidebar={() => setSidebarOpen(false)} />;
      case 'email':     return <EmailManager />;
      case 'tasks':     return <TasksView />;
      case 'calendar':  return <CalendarView />;
      case 'team':      return <TeamManager />;
      case 'insights':  return <WeeklyInsights />;
      case 'settings':  return <SettingsView />;
      default:          return <MorningBriefing />;
    }
  };

  return (
    <SettingsProvider 
      userName={user?.name} 
      userEmail={user?.email} 
      userCompany={user?.company} 
      userRole={user?.role}
    >
      <AppProvider>
        <div className="flex bg-slate-50 relative" style={{ width: '100%', height: '100dvh' }}>
          {/* Mobile overlay */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* Sidebar - hidden completely on mobile <= 768px (Fix 3) */}
          <div className={`
            hidden md:block fixed lg:relative inset-y-0 left-0 z-50
            transform transition-transform duration-300 ease-in-out
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          `}>
            <Sidebar activeView={activeView} onViewChange={handleViewChange} />
          </div>

          {/* Main content */}
          <main className="flex-1 w-full flex flex-col overflow-hidden">
            {user && (user as any).emailVerified === false && (
              <div className="bg-amber-500 text-white px-4 py-2.5 text-xs sm:text-sm flex flex-col sm:flex-row items-center justify-between font-medium flex-shrink-0 gap-2 border-b border-amber-600/20">
                <span className="text-center sm:text-left">
                  ⚠️ Your email is not verified. Some features may be limited. Please check your inbox, spam, and promotions folders.
                </span>
                <div className="flex gap-2 flex-shrink-0">
                  <button 
                    onClick={async () => {
                      const res = await resendVerification(user.email);
                      if (res.success) {
                        alert('Verification email resent! Please check your spam folder.');
                      } else {
                        alert(res.error || 'Failed to resend verification.');
                      }
                    }}
                    className="underline hover:text-amber-100 font-bold px-2 py-1 rounded hover:bg-white/10 transition-all text-white border-none bg-transparent cursor-pointer"
                  >
                    Resend Email
                  </button>
                  <button 
                    onClick={() => {
                      setPendingEmail(user.email);
                      setIsVerifying(true);
                    }}
                    className="bg-white text-amber-700 font-bold px-3 py-1 rounded hover:bg-amber-50 transition-all shadow-sm border-none cursor-pointer"
                  >
                    Verify Now
                  </button>
                </div>
              </div>
            )}
            {/* Mobile header */}
            <div className="lg:hidden flex items-center justify-between p-4 bg-gradient-to-b from-slate-900 to-slate-800 border-b border-slate-700 flex-shrink-0">
              <div className="flex items-center gap-3">
                {/* Menu hamburger button - hidden completely on mobile <= 768px (Fix 3) */}
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="hidden md:block p-2 text-white hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                <div className="flex items-center gap-2">
                  <RyveLogo size={32} variant="dark" />
                  <div>
                    <span className="font-bold bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">Ryve</span>
                    <p className="text-xs text-slate-400">AI Chief of Staff</p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleViewChange('settings')}
                className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center hover:opacity-90 transition-opacity"
              >
                <Avatar 
                  email={user?.email} 
                  name={user?.name} 
                  photoURL={user?.photoURL} 
                  size={32} 
                  className="rounded-lg"
                />
              </button>
            </div>

            {/* Added main-content-mobile-spacer to prevent bottom nav clipping (Fix 3) */}
            <div className="flex-1 overflow-hidden main-content-mobile-spacer">
              {renderView()}
            </div>
          </main>
          
          {/* Global AI Quick Action Widget — hidden on settings, email, briefing, and chat pages */}
          {activeView !== 'chat' && activeView !== 'briefing' && activeView !== 'settings' && <QuickAskWidget />}

          {/* Mobile Bottom Navigation Bar (Fix 3) */}
          <BottomNavBar 
            activeView={activeView} 
            onViewChange={handleViewChange} 
            onMoreClick={() => setMoreOpen(true)} 
          />

          {/* Mobile More Sheet Menu (Fix 3) */}
          <MoreBottomSheet 
            isOpen={moreOpen} 
            onClose={() => setMoreOpen(false)} 
            activeView={activeView} 
            onViewChange={handleViewChange} 
          />

          {/* Email verification dialog */}
          {isVerifying && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full">
                <div className="flex flex-col items-center mb-6">
                  <div className="w-14 h-14 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 mb-4">
                    <ShieldCheck className="w-8 h-8" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-800">Verify Your Email</h2>
                  <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mt-4 mb-2">
                    <p className="text-indigo-900 font-semibold text-sm mb-1">Check your inbox</p>
                    <p className="text-indigo-700 text-xs leading-relaxed">
                      We sent a 6-digit code to <span className="font-bold">{pendingEmail || user?.email}</span>. 
                      It may take 1-2 minutes to arrive. Please check your spam or junk folder if you don't see it.
                    </p>
                  </div>
                </div>
                <form onSubmit={handleVerificationSubmit} className="space-y-4">
                  {verificationError && (
                    <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl text-sm text-center">{verificationError}</div>
                  )}
                  <input
                    type="text"
                    maxLength={6}
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="w-full text-center tracking-[0.5em] font-mono text-xl py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-slate-900"
                    required
                  />
                  <button type="submit" disabled={verificationLoading || verificationCode.length !== 6}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed border-none cursor-pointer">
                    {verificationLoading ? 'Verifying...' : 'Verify & Update'}
                  </button>
                  <button type="button" onClick={() => setIsVerifying(false)}
                    className="w-full flex items-center justify-center gap-1 text-xs text-slate-400 hover:text-slate-600 bg-transparent border-none cursor-pointer">
                    <ArrowLeft className="w-3 h-3" /> Back
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </AppProvider>
    </SettingsProvider>
  );
}