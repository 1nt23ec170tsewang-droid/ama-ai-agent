import { MessageSquare, CheckSquare, Calendar, Settings, Brain, Mail, Sun, BarChart3, Users, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { useSettings } from '../context/SettingsContext';
import { useState, useEffect } from 'react';

interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
}

function getRelativeTime(timestamp: string): string {
  try {
    const ms = parseInt(timestamp, 10);
    if (isNaN(ms)) return 'Recent';
    const date = new Date(ms);
    const now = new Date();
    
    if (date.toDateString() === now.toDateString()) {
      return 'Today';
    }
    
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 7) {
      return `${diffDays}d ago`;
    }
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch (e) {
    return 'Recent';
  }
}

export function Sidebar({ activeView, onViewChange }: SidebarProps) {
  const { user } = useAuth();
  const { tasks } = useApp();
  const { profile } = useSettings();

  const [chatSessions, setChatSessions] = useState<{id: string, title: string}[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  useEffect(() => {
    const updateSessions = () => {
      const saved = localStorage.getItem('ama_chat_sessions');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setChatSessions(parsed);
        } catch(e){}
      } else {
        setChatSessions([]);
      }
    };
    updateSessions();
    window.addEventListener('ama_chat_sessions_updated', updateSessions);
    return () => window.removeEventListener('ama_chat_sessions_updated', updateSessions);
  }, []);

  useEffect(() => {
    // Sync initial active session from localStorage
    try {
      const saved = localStorage.getItem('ama_chat_sessions');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.length > 0) {
          setActiveSessionId(parsed[0].id);
        }
      }
    } catch(e){}

    const handleSelect = (e: any) => {
      setActiveSessionId(e.detail);
    };
    window.addEventListener('select_chat_session', handleSelect);
    return () => window.removeEventListener('select_chat_session', handleSelect);
  }, []);

  const handleDeleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm('Delete this chat session?')) return;
    
    const saved = localStorage.getItem('ama_chat_sessions');
    if (saved) {
      try {
        const sessionsList = JSON.parse(saved);
        const updated = sessionsList.filter((s: any) => s.id !== id);
        localStorage.setItem('ama_chat_sessions', JSON.stringify(updated));
        window.dispatchEvent(new Event('ama_chat_sessions_updated'));
        
        if (activeSessionId === id) {
          const nextActive = updated.length > 0 ? updated[0].id : null;
          window.dispatchEvent(new CustomEvent('select_chat_session', { detail: nextActive }));
        }
      } catch(err){}
    }
  };

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
    <div className="w-64 bg-gradient-to-b from-slate-900 to-slate-800 text-white flex flex-col h-full select-none">
      {/* Logo */}
      <div className="p-6 border-b border-slate-700 shrink-0">
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
      <nav className="p-4 shrink-0 border-b border-slate-800/60">
        {menuItems.map(item => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              onClick={() => onViewChange(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg mb-1 transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/40'
                  : 'text-slate-300 hover:bg-slate-700/50'
              }`}
            >
              <Icon className="w-4.5 h-4.5 flex-shrink-0" />
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

      {/* Chat History Section */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-2 px-2 shrink-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <MessageSquare className="w-3 h-3 text-slate-500" />
            Recent Chats
          </span>
          <button 
            onClick={() => {
              window.dispatchEvent(new CustomEvent('select_chat_session', { detail: null }));
              onViewChange('chat'); 
            }}
            className="text-[10px] px-2 py-0.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 rounded font-bold transition-all border border-amber-500/20"
          >
            + NEW
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-1 pr-1 scrollbar-none">
          {chatSessions.length === 0 ? (
            <div className="text-center py-6 px-2 text-xs text-slate-500 italic">
              No previous chats
            </div>
          ) : (
            chatSessions.map(session => {
              const isActive = activeView === 'chat' && activeSessionId === session.id;
              return (
                <div 
                  key={session.id} 
                  className={`group relative flex items-center justify-between rounded-lg transition-all ${
                    isActive 
                      ? 'bg-slate-700/60 text-white shadow-sm border-l-2 border-amber-500' 
                      : 'text-slate-300 hover:bg-slate-800/40 hover:text-white'
                  }`}
                >
                  <button
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('select_chat_session', { detail: session.id }));
                      onViewChange('chat');
                    }}
                    className="flex-1 text-left text-xs p-2.5 truncate pr-16"
                    title={session.title || 'New Chat'}
                  >
                    {session.title || 'New Chat'}
                  </button>
                  
                  {/* Timestamp and Trash Button container */}
                  <div className="absolute right-2 flex items-center gap-1.5">
                    <span className="text-[9px] text-slate-500 group-hover:hidden transition-all">
                      {getRelativeTime(session.id)}
                    </span>
                    <button
                      onClick={(e) => handleDeleteSession(e, session.id)}
                      className="hidden group-hover:flex p-1 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded transition-all"
                      title="Delete chat"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* User footer */}
      <div className="p-4 border-t border-slate-700 shrink-0">
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

