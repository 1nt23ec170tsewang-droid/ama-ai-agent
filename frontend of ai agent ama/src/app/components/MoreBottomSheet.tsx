import React, { useEffect } from 'react';
import { Calendar, BarChart2, Users, Settings, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface MoreBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  activeView: string;
  onViewChange: (view: string) => void;
}

export default function MoreBottomSheet({ isOpen, onClose, activeView, onViewChange }: MoreBottomSheetProps) {
  const { logout } = useAuth();

  // Prevent background scroll when sheet is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const menuItems = [
    {
      id: 'calendar',
      label: 'Calendar',
      icon: Calendar,
      view: 'calendar'
    },
    {
      id: 'insights',
      label: 'Analytics',
      icon: BarChart2,
      view: 'insights'
    },
    {
      id: 'team',
      label: 'Team',
      icon: Users,
      view: 'team'
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      view: 'settings'
    }
  ];

  const handleItemClick = (view: string) => {
    onViewChange(view);
    onClose();
  };

  const handleSignOutClick = async () => {
    onClose();
    await logout();
  };

  return (
    <div className="fixed inset-0 z-[1100] md:hidden">
      {/* Backdrop overlay */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
      />
      
      {/* Sliding Sheet Panel */}
      <div 
        className="absolute bottom-0 left-0 right-0 bg-[#0b0d1a] border-t border-white/10 rounded-t-2xl px-5 pb-8 pt-4 flex flex-col z-[1200] max-h-[85vh] transition-transform duration-300 ease-out transform translate-y-0"
        style={{ paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}
      >
        {/* Top Drag Handle Bar */}
        <div className="w-full flex justify-center mb-5">
          <div className="w-9 h-1 bg-white/20 rounded-full" />
        </div>

        {/* Title */}
        <div className="text-white font-mono text-xs text-slate-400 mb-4 px-2 uppercase tracking-widest">
          More Menu
        </div>

        {/* Menu Items */}
        <div className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.view;
            
            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item.view)}
                className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all active:scale-[0.98] ${
                  isActive 
                    ? 'bg-amber-500/10 text-[#e8b84b] border border-amber-500/20' 
                    : 'text-[#8888aa] hover:text-[#e8b84b] active:bg-white/5 border border-transparent'
                }`}
                style={{ fontFamily: 'Manrope, Inter, sans-serif', fontSize: '14px' }}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-[#e8b84b]' : 'text-[#8888aa]'}`} />
                <span className="font-semibold">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Divider line */}
        <div className="my-4 h-px bg-white/10" />

        {/* Sign Out Button */}
        <button
          onClick={handleSignOutClick}
          className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-[#ff5e72] hover:bg-[#ff5e72]/10 active:bg-[#ff5e72]/20 transition-all border border-transparent"
          style={{ fontFamily: 'Manrope, Inter, sans-serif', fontSize: '14px' }}
        >
          <LogOut className="w-5 h-5 text-[#ff5e72]" />
          <span className="font-bold">Sign Out</span>
        </button>
      </div>
    </div>
  );
}
