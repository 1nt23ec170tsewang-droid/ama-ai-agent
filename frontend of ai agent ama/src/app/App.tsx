import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
import MoreBottomSheet from './components/MoreBottomSheet';

const getInitials = (name: string) => {
  if (!name) return 'U';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
};

export default function App() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState('briefing');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

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
                className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center text-white font-semibold text-sm hover:from-orange-600 hover:to-orange-700 transition-colors overflow-hidden"
              >
                {user?.photoURL ? (
                  <img 
                    src={user.photoURL} 
                    alt="Avatar" 
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).parentElement!.innerHTML = `<span class="text-white font-semibold text-sm">${authenticatedUser.initials}</span>`; }}
                  />
                ) : (
                  authenticatedUser.initials
                )}
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
        </div>
      </AppProvider>
    </SettingsProvider>
  );
}