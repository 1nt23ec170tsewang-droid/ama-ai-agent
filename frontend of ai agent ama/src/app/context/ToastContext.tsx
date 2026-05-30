import { createContext, useContext, useState, useCallback, ReactNode, useEffect, ReactElement } from 'react';
import { CheckCircle, XCircle, Info, Loader2, X, AlertTriangle } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info' | 'warning' | 'loading';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => string;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  useEffect(() => {
    // Standard toasts dismiss after 4s. Loading toasts get a 15s safety fallback
    // so they never get permanently stuck if a network request hangs.
    const duration = toast.type === 'loading' ? 15000 : 4000;
    const timer = setTimeout(() => onRemove(toast.id), duration);
    return () => clearTimeout(timer);
  }, [toast, onRemove]);

  const styles: Record<ToastType, { bg: string; border: string; text: string; icon: ReactElement }> = {
    success: {
      bg: 'bg-emerald-900/95',
      border: 'border-emerald-500/50',
      text: 'text-emerald-100',
      icon: <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />,
    },
    error: {
      bg: 'bg-red-900/95',
      border: 'border-red-500/50',
      text: 'text-red-100',
      icon: <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />,
    },
    info: {
      bg: 'bg-blue-900/95',
      border: 'border-blue-500/50',
      text: 'text-blue-100',
      icon: <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />,
    },
    warning: {
      bg: 'bg-amber-900/95',
      border: 'border-amber-500/50',
      text: 'text-amber-100',
      icon: <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />,
    },
    loading: {
      bg: 'bg-amber-900/95',
      border: 'border-amber-500/50',
      text: 'text-amber-100',
      icon: <Loader2 className="w-4 h-4 text-amber-400 flex-shrink-0 animate-spin" />,
    },
  };

  const s = styles[toast.type];

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-sm shadow-2xl max-w-sm w-full
        ${s.bg} ${s.border} ${s.text}
        animate-in slide-in-from-right-5 fade-in duration-300`}
      style={{ animation: 'slideInRight 0.3s ease-out' }}
    >
      {s.icon}
      <span className="text-sm font-medium flex-1">{toast.message}</span>
      {toast.type !== 'loading' && (
        <button
          onClick={() => onRemove(toast.id)}
          className="p-0.5 hover:opacity-70 transition-opacity"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now().toString() + Math.random().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem toast={toast} onRemove={removeToast} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
