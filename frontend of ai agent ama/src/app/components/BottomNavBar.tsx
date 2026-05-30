import React, { useState, useEffect } from 'react';
import { Home, Mail, ClipboardList, Sparkles, MoreHorizontal } from 'lucide-react';
import { API_BASE } from '../utils/config';

interface BottomNavBarProps {
  activeView: string;
  onViewChange: (view: string) => void;
  onMoreClick: () => void;
}

export default function BottomNavBar({ activeView, onViewChange, onMoreClick }: BottomNavBarProps) {
  const [unreadEmails, setUnreadEmails] = useState<number>(3);
  const [dueTasks, setDueTasks] = useState<number>(2);

  // Periodically fetch dynamic badge counts to make the PWA feel live and premium (Fix 3)
  useEffect(() => {
    const fetchBadgeStats = async () => {
      const token = localStorage.getItem('ama_token') || localStorage.getItem('authToken');
      if (!token) return;

      try {
        // Fetch briefing dashboard to get unread email count
        const briefRes = await fetch(`${API_BASE}/api/dashboard/briefing`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        if (briefRes.ok) {
          const data = await briefRes.json();
          if (typeof data.unreadEmails === 'number') {
            setUnreadEmails(data.unreadEmails);
          }
        }

        // Fetch tasks to calculate due-today counts
        const tasksRes = await fetch(`${API_BASE}/api/dashboard/tasks`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        if (tasksRes.ok) {
          const tasks = await tasksRes.json();
          if (Array.isArray(tasks)) {
            // Count todo/in-progress tasks that are due today
            const todayStr = new Date().toISOString().split('T')[0];
            const dueTodayCount = tasks.filter(t => t.col !== 'done' && t.dueDate === todayStr).length;
            setDueTasks(dueTodayCount || tasks.filter(t => t.col !== 'done').length);
          }
        }
      } catch (err) {
        console.warn('Failed to fetch badge counts:', err);
      }
    };

    fetchBadgeStats();
    const interval = setInterval(fetchBadgeStats, 30000); // 30 seconds
    return () => clearInterval(interval);
  }, []);

  const tabs = [
    {
      id: 'briefing',
      label: 'Briefing',
      icon: Home,
    },
    {
      id: 'email',
      label: 'Inbox',
      icon: Mail,
      badge: unreadEmails > 0 ? unreadEmails : null,
    },
    {
      id: 'chat',
      label: 'Ama',
      icon: Sparkles,
      isCenter: true,
    },
    {
      id: 'tasks',
      label: 'Tasks',
      icon: ClipboardList,
      badge: dueTasks > 0 ? dueTasks : null,
    },
    {
      id: 'more',
      label: 'More',
      icon: MoreHorizontal,
      isMoreButton: true,
    }
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-[#0b0d1a] border-t border-white/10 flex items-center justify-around z-[1000] px-2 select-none"
         style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeView === tab.id;

        if (tab.isCenter) {
          return (
            <button
              key={tab.id}
              onClick={() => onViewChange(tab.id)}
              className="relative w-13 h-13 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all -translate-y-4 focus:outline-none"
              style={{
                width: '52px',
                height: '52px',
                marginTop: '-12px',
                border: '4px solid #09051d'
              }}
              title="Ask Ama Anything"
            >
              <Icon className="w-6 h-6 text-slate-950 stroke-[2.5]" />
            </button>
          );
        }

        return (
          <button
            key={tab.label}
            onClick={() => {
              if (tab.isMoreButton) {
                onMoreClick();
              } else {
                onViewChange(tab.id);
              }
            }}
            className="relative flex flex-col items-center justify-center w-16 h-full text-[#8888aa] hover:text-[#e8b84b] active:bg-[#e8b84b]/10 rounded-xl transition-all focus:outline-none py-1"
          >
            <div className="relative">
              <Icon className={`w-5 h-5 transition-all ${isActive ? 'text-[#e8b84b] scale-110' : 'text-[#8888aa]'}`} />
              
              {/* Badges (Fix 3) */}
              {tab.badge !== null && tab.badge !== undefined && (
                <span className="absolute -top-1.5 -right-1.5 bg-[#ff5e72] text-white text-[9px] font-bold rounded-full h-4 min-w-4 px-1 flex items-center justify-center border border-[#0b0d1a] shadow-sm animate-pulse">
                  {tab.badge}
                </span>
              )}
            </div>

            <span className={`text-[9px] font-mono mt-1 tracking-tight ${isActive ? 'text-[#e8b84b] font-semibold' : 'text-[#8888aa]'}`}>
              {tab.label}
            </span>

            {/* Active Gold Indicator Dot (Fix 3) */}
            {isActive && (
              <span className="absolute bottom-1 w-1 h-1 bg-[#e8b84b] rounded-full" />
            )}
          </button>
        );
      })}
    </div>
  );
}
