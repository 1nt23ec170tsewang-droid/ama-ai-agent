import { MessageSquare, CheckSquare, Calendar, Settings, Brain, Mail, Sun, BarChart3, Users, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { useSettings } from '../context/SettingsContext';
import { useState, useEffect } from 'react';

interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
}

export function Sidebar({ activeView, onViewChange }: SidebarProps) {
  const { user } = useAuth();
  const { tasks } = useApp();
  const { profile } = useSettings();

  const [chatSessions, setChatSessions] = useState<{id: string, title: string}[]>([]);

  useEffect(() => {
    const updateSessions = () => {
      const saved = localStorage.getItem('ama_chat_sessions');
      if (saved) {
        try {
          setChatSessions(JSON.parse(saved));
        } catch(e){}
      } else {
        setChatSessions([]);
      }
    };
    updateSessions();
    window.addEventListener('ama_chat_sessions_updated', updateSessions);
    return () => window.removeEventListener('ama_chat_sessions_updated', updateSessions);
  }, []);

  const name = profile?.name || user?.name || 'User';
  const email = profile?.email || user?.email || 'user@example.com';
  const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2);

  // Live badges from real data
  const overdueTasks = tasks.filter(t => {
    if (t.completed) return false;
    if (!t.dueDate) return false;
    return new Date(t.dueDate) < new Date(new Date().toDateString());
  }).length;

  const menuItems = [
    { id: 'briefing',  icon: Sun,           label: 'Morning Briefing' },
    { id: 'chat',      icon: MessageSquare,  label: 'AI Assistant'     },
    { id: 'tasks',     icon: CheckSquare,    label: 'Task Tracker',    badge: overdueTasks > 0 ? overdueTasks : null },
    { id: 'calendar',  icon: Calendar,       label: 'Calendar'         },
    { id: 'email',     icon: Mail,           label: 'Email Manager'    },
    { id: 'team',      icon: Users,          label: 'Team Manager'     },
    { id: 'insights',  icon: BarChart3,      label: 'Analytics'        },
  ];

  return (
    <div className="w-64 bg-gradient-to-b from-slate-900 to-slate-800 text-white flex flex-col h-full">
      {/* Logo */}
      <div className="p-6 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
            <Brain className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">Ama</h1>
            <p className="text-xs text-slate-400">Chief of Staff Agent</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 overflow-y-auto">
        {menuItems.map(item => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              onClick={() => onViewChange(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-1.5 transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/40'
                  : 'text-slate-300 hover:bg-slate-700/50'
              }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="flex-1 text-left text-sm">{item.label}</span>
              {item.badge && (
                <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Mobile Chat History (Hidden on Desktop) */}
      {activeView === 'chat' && (
        <div className="md:hidden p-4 border-t border-slate-700 overflow-y-auto max-h-48 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" />
              Chat History
            </span>
            <button 
              onClick={() => {
                window.dispatchEvent(new CustomEvent('select_chat_session', { detail: null }));
                onViewChange('chat'); 
              }}
              className="text-[10px] px-1.5 py-0.5 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 rounded font-medium transition-colors"
            >
              + NEW
            </button>
          </div>
          <div className="space-y-1">
            {chatSessions.length === 0 ? (
              <p className="text-xs text-slate-500 py-1">No recent history</p>
            ) : (
              chatSessions.map(session => (
                <div key={session.id} className="group flex items-center justify-between hover:bg-slate-700/50 rounded transition-colors">
                  <button
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('select_chat_session', { detail: session.id }));
                      onViewChange('chat');
                    }}
                    className="flex-1 text-left text-sm text-slate-300 hover:text-white p-2 truncate"
                  >
                    {session.title || 'Chat'}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* User footer */}
      <div className="p-4 border-t border-slate-700">
        <button
          id="nav-settings"
          onClick={() => onViewChange('settings')}
          className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-700/50 transition-colors"
        >
          <div 
            className="w-9 h-9 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 overflow-hidden bg-cover bg-center"
            style={profile?.avatar ? { backgroundImage: `url(${profile.avatar})` } : {}}
          >
            {!profile?.avatar && initials}
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="text-sm font-medium text-white truncate">{name}</p>
            <p className="text-xs text-slate-400 truncate">{email}</p>
          </div>
          <Settings className="w-4 h-4 text-slate-400 flex-shrink-0" />
        </button>
      </div>
    </div>
  );
}
