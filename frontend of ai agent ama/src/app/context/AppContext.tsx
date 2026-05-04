import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

const API_BASE = (import.meta as any).env?.VITE_API_URL || 'https://ama-ai-agent-toxa.vercel.app';

// ── Types ──────────────────────────────────────────────────────────────────────
export interface AmaEvent {
  id: string;
  title: string;
  time: string;
  duration: string;
  type: string;
  location: string;
  attendees: number;
  date?: string;
}

export interface AmaTask {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  status: 'todo' | 'in-progress' | 'done';
  completed: boolean;
  dueDate: string;
  createdAt: string;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  department: string;
  email: string;
  phone?: string;
  avatar: string;
  status: 'online' | 'away' | 'offline';
  workload: 'high' | 'medium' | 'low';
  taskCompletion: number;
  currentKPI: string;
  tasksCompleted: number;
  tasksTotal: number;
  metrics: {
    productivity: number;
    responseTime: string;
    projectsActive: number;
  };
}

export interface Metric {
  id: string;
  label: string;
  value: string;
  unit: string;
  trend: 'up' | 'down' | 'neutral';
  updatedAt: string;
}

interface AppContextType {
  // Events
  events: AmaEvent[];
  addEvent: (event: Omit<AmaEvent, 'id'>) => void;
  updateEvent: (id: string, event: Partial<AmaEvent>) => void;
  deleteEvent: (id: string) => void;
  // Tasks
  tasks: AmaTask[];
  addTask: (task: Omit<AmaTask, 'id' | 'createdAt'>) => void;
  updateTask: (id: string, task: Partial<AmaTask>) => void;
  deleteTask: (id: string) => void;
  // Team
  team: TeamMember[];
  addTeamMember: (member: Omit<TeamMember, 'id' | 'avatar'>) => void;
  updateTeamMember: (id: string, member: Partial<TeamMember>) => void;
  deleteTeamMember: (id: string) => void;
  // Analytics metrics
  metrics: Metric[];
  addMetric: (metric: Omit<Metric, 'id' | 'updatedAt'>) => void;
  updateMetric: (id: string, metric: Partial<Metric>) => void;
  deleteMetric: (id: string) => void;
  // Sync state
  isSyncing: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// ── localStorage helpers (fallback) ───────────────────────────────────────────
function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save<T>(key: string, value: T) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* noop */ }
}

// ── API helpers ────────────────────────────────────────────────────────────────
function getToken(): string | null {
  return localStorage.getItem('authToken');
}

function authHeaders() {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...authHeaders(), ...(options?.headers || {}) },
  });
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
  return res.json();
}

const initials = (name: string) =>
  name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

// ── Provider ───────────────────────────────────────────────────────────────────
export function AppProvider({ children }: { children: ReactNode }) {
  const [events,  setEvents]  = useState<AmaEvent[]>(() => load('ama_events', []));
  const [tasks,   setTasks]   = useState<AmaTask[]>(()  => load('ama_tasks', []));
  const [team,    setTeam]    = useState<TeamMember[]>(() => load('ama_team', []));
  const [metrics, setMetrics] = useState<Metric[]>(() => load('ama_metrics', []));
  const [isSyncing, setIsSyncing] = useState(false);

  // ── Migrate localStorage data to backend (one-time, on first login) ──────────
  const migrateLocalData = useCallback(async () => {
    const migrated = localStorage.getItem('ama_migrated_to_backend');
    if (migrated) return; // Already done

    const localTasks: AmaTask[] = load('ama_tasks', []);
    const localEvents: AmaEvent[] = load('ama_events', []);

    // Push each local task to backend
    for (const task of localTasks) {
      try {
        await apiFetch('/api/tasks', { method: 'POST', body: JSON.stringify(task) });
      } catch { /* silent — will be fetched from backend */ }
    }
    // Push each local non-Google event to backend
    for (const evt of localEvents) {
      if (!evt.id.startsWith('task_') && !evt.id.startsWith('cal_')) {
        try {
          await apiFetch('/api/events', { method: 'POST', body: JSON.stringify(evt) });
        } catch { /* silent */ }
      }
    }
    localStorage.setItem('ama_migrated_to_backend', 'true');
    console.log('✅ Local data migrated to backend');
  }, []);

  // ── Load all data from backend on mount / when token changes ─────────────────
  const syncFromBackend = useCallback(async () => {
    const token = getToken();
    if (!token) return; // Not logged in — keep localStorage data

    // Migrate any pre-existing localStorage data on first run
    await migrateLocalData();
    setIsSyncing(true);
    try {
      const [tasksData, eventsData, metricsData] = await Promise.all([
        apiFetch('/api/tasks').catch(() => null),
        apiFetch('/api/events').catch(() => null),
        apiFetch('/api/metrics').catch(() => null),
      ]);

      if (Array.isArray(tasksData)) {
        setTasks(tasksData);
        save('ama_tasks', tasksData);
      }
      if (Array.isArray(eventsData)) {
        // Merge with Google Calendar events if available
        const email = localStorage.getItem('ama_gmail_email');
        const isConnected = localStorage.getItem('ama_calendar_connected') === 'true';
        if (email && isConnected) {
          try {
            const calRes = await fetch(`${API_BASE}/api/calendar/events?email=${encodeURIComponent(email)}`);
            if (calRes.ok) {
              const calData = await calRes.json();
              if (calData.events) {
                // Merge: calendar events override local events with same id
                const merged = [...eventsData, ...calData.events.filter(
                  (ce: AmaEvent) => !eventsData.find((e: AmaEvent) => e.id === ce.id)
                )];
                setEvents(merged);
                save('ama_events', merged);
              } else {
                setEvents(eventsData);
                save('ama_events', eventsData);
              }
            } else {
              setEvents(eventsData);
              save('ama_events', eventsData);
            }
          } catch {
            setEvents(eventsData);
            save('ama_events', eventsData);
          }
        } else {
          setEvents(eventsData);
          save('ama_events', eventsData);
        }
      }
      if (Array.isArray(metricsData)) {
        setMetrics(metricsData);
        save('ama_metrics', metricsData);
      }
    } catch (e) {
      console.warn('⚠️ Backend sync failed — using localStorage fallback', e);
    } finally {
      setIsSyncing(false);
    }
  }, [migrateLocalData]);

  // Run sync on mount; re-run whenever the authToken changes
  useEffect(() => {
    syncFromBackend();
    // Also poll every 60s to stay up-to-date across tabs/devices
    const interval = setInterval(syncFromBackend, 60000);
    return () => clearInterval(interval);
  }, [syncFromBackend]);

  // ── Also keep localStorage in sync for offline resilience ──────────────────
  useEffect(() => { save('ama_events', events);  }, [events]);
  useEffect(() => { save('ama_tasks', tasks);    }, [tasks]);
  useEffect(() => { save('ama_team', team);      }, [team]);
  useEffect(() => { save('ama_metrics', metrics); }, [metrics]);

  // ── Events ──────────────────────────────────────────────────────────────────
  const addEvent = async (event: Omit<AmaEvent, 'id'>) => {
    const email = localStorage.getItem('ama_gmail_email');
    const isConnected = localStorage.getItem('ama_calendar_connected') === 'true';

    if (email && isConnected) {
      // Try Google Calendar first
      try {
        const res = await fetch(`${API_BASE}/api/calendar/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, ...event }),
        });
        const data = await res.json();
        if (data.success) {
          const newEvent: AmaEvent = { id: data.eventId, ...event };
          setEvents(prev => [...prev, newEvent]);
          return;
        }
      } catch (e) {
        console.error('Failed to create Google Calendar event', e);
      }
    }

    // Fallback: save to backend Firestore events collection
    try {
      const saved = await apiFetch('/api/events', {
        method: 'POST',
        body: JSON.stringify(event),
      });
      setEvents(prev => [...prev, saved]);
    } catch {
      // Offline fallback
      const newEvent: AmaEvent = { id: `evt_${Date.now()}`, ...event };
      setEvents(prev => [...prev, newEvent]);
    }
  };

  const updateEvent = async (id: string, data: Partial<AmaEvent>) => {
    setEvents(prev => prev.map(e => e.id === id ? { ...e, ...data } : e));
    try { await apiFetch(`/api/events/${id}`, { method: 'PUT', body: JSON.stringify(data) }); } catch { /* offline */ }
  };

  const deleteEvent = async (id: string) => {
    setEvents(prev => prev.filter(e => e.id !== id));
    try { await apiFetch(`/api/events/${id}`, { method: 'DELETE' }); } catch { /* offline */ }
  };

  // ── Tasks ───────────────────────────────────────────────────────────────────
  const addTask = async (task: Omit<AmaTask, 'id' | 'createdAt'>) => {
    try {
      const saved = await apiFetch('/api/tasks', { method: 'POST', body: JSON.stringify(task) });
      setTasks(prev => [...prev, saved]);
    } catch {
      // Offline fallback
      const newTask: AmaTask = { id: `task_${Date.now()}`, createdAt: new Date().toISOString(), ...task };
      setTasks(prev => [...prev, newTask]);
    }
  };

  const updateTask = async (id: string, data: Partial<AmaTask>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...data } : t));
    try { await apiFetch(`/api/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }); } catch { /* offline */ }
  };

  const deleteTask = async (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    try { await apiFetch(`/api/tasks/${id}`, { method: 'DELETE' }); } catch { /* offline */ }
  };

  // ── Team ─────────────────────────────────────────────────────────────────────
  // Team is not synced to backend by user-id in a simple REST way here (uses ownerId).
  // Keep local + localStorage for now; can extend later.
  const addTeamMember = (member: Omit<TeamMember, 'id' | 'avatar'>) => {
    const newMember: TeamMember = { id: `member_${Date.now()}`, avatar: initials(member.name), ...member };
    setTeam(prev => [...prev, newMember]);
  };
  const updateTeamMember = (id: string, data: Partial<TeamMember>) => {
    setTeam(prev => prev.map(m => m.id === id ? { ...m, ...data } : m));
  };
  const deleteTeamMember = (id: string) => {
    setTeam(prev => prev.filter(m => m.id !== id));
  };

  // ── Metrics ─────────────────────────────────────────────────────────────────
  const addMetric = async (metric: Omit<Metric, 'id' | 'updatedAt'>) => {
    try {
      const saved = await apiFetch('/api/metrics', { method: 'POST', body: JSON.stringify(metric) });
      setMetrics(prev => [...prev, saved]);
    } catch {
      const newMetric: Metric = { id: `metric_${Date.now()}`, updatedAt: new Date().toISOString(), ...metric };
      setMetrics(prev => [...prev, newMetric]);
    }
  };

  const updateMetric = async (id: string, data: Partial<Metric>) => {
    setMetrics(prev => prev.map(m => m.id === id ? { ...m, ...data, updatedAt: new Date().toISOString() } : m));
    try { await apiFetch(`/api/metrics/${id}`, { method: 'PUT', body: JSON.stringify(data) }); } catch { /* offline */ }
  };

  const deleteMetric = async (id: string) => {
    setMetrics(prev => prev.filter(m => m.id !== id));
    try { await apiFetch(`/api/metrics/${id}`, { method: 'DELETE' }); } catch { /* offline */ }
  };

  return (
    <AppContext.Provider value={{
      events, addEvent, updateEvent, deleteEvent,
      tasks, addTask, updateTask, deleteTask,
      team, addTeamMember, updateTeamMember, deleteTeamMember,
      metrics, addMetric, updateMetric, deleteMetric,
      isSyncing,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within an AppProvider');
  return ctx;
}
