import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { collection, doc, onSnapshot, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../utils/firebase';
import { useAuth } from './AuthContext';

const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000';

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
  addEvent: (event: Omit<AmaEvent, 'id'>) => Promise<void>;
  updateEvent: (id: string, event: Partial<AmaEvent>) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  // Tasks
  tasks: AmaTask[];
  addTask: (task: Omit<AmaTask, 'id' | 'createdAt'>) => Promise<void>;
  updateTask: (id: string, task: Partial<AmaTask>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  // Team
  team: TeamMember[];
  addTeamMember: (member: Omit<TeamMember, 'id' | 'avatar'>) => void;
  updateTeamMember: (id: string, member: Partial<TeamMember>) => void;
  deleteTeamMember: (id: string) => void;
  // Analytics metrics
  metrics: Metric[];
  addMetric: (metric: Omit<Metric, 'id' | 'updatedAt'>) => Promise<void>;
  updateMetric: (id: string, metric: Partial<Metric>) => Promise<void>;
  deleteMetric: (id: string) => Promise<void>;
  // Sync state
  isSyncing: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// ── localStorage helpers ───────────────────────────────────────────────────────
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

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

// ── API helpers (Fallback path) ────────────────────────────────────────────────
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

// ── Provider ───────────────────────────────────────────────────────────────────
export function AppProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  
  const [events, setEvents] = useState<AmaEvent[]>(() => load('ama_events', []));
  const [tasks, setTasks] = useState<AmaTask[]>(() => load('ama_tasks', []));
  const [team, setTeam] = useState<TeamMember[]>(() => load('ama_team', []));
  const [metrics, setMetrics] = useState<Metric[]>(() => load('ama_metrics', []));
  const [isSyncing, setIsSyncing] = useState(false);

  // ── Original REST sync fallback ──────────────────────────────────────────────
  const migrateLocalData = useCallback(async () => {
    const migrated = localStorage.getItem('ama_migrated_to_backend');
    if (migrated) return;

    const localTasks: AmaTask[] = load('ama_tasks', []);
    const localEvents: AmaEvent[] = load('ama_events', []);

    for (const task of localTasks) {
      try { await apiFetch('/api/tasks', { method: 'POST', body: JSON.stringify(task) }); } catch {}
    }
    for (const evt of localEvents) {
      if (!evt.id.startsWith('task_') && !evt.id.startsWith('cal_')) {
        try { await apiFetch('/api/events', { method: 'POST', body: JSON.stringify(evt) }); } catch {}
      }
    }
    localStorage.setItem('ama_migrated_to_backend', 'true');
  }, []);

  const syncFromBackendFallback = useCallback(async () => {
    const token = getToken();
    if (!token) return;

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
        const email = localStorage.getItem('ama_gmail_email');
        const isConnected = localStorage.getItem('ama_calendar_connected') === 'true';
        if (email && isConnected) {
          try {
            const calRes = await fetch(`${API_BASE}/api/calendar/events?email=${encodeURIComponent(email)}`);
            if (calRes.ok) {
              const calData = await calRes.json();
              if (calData.events) {
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
      console.warn('⚠️ REST API sync failed — using localStorage cache fallback', e);
    } finally {
      setIsSyncing(false);
    }
  }, [migrateLocalData]);

  // ── Unified Database Observers or REST API sync engine ────────────────────────
  useEffect(() => {
    if (!user?.id) {
      setTasks([]);
      setEvents([]);
      return;
    }

    if (db) {
      // Modern real-time path
      setIsSyncing(true);

      const tasksQuery = query(collection(db, 'users', user.id, 'tasks'), orderBy('createdAt', 'desc'));
      const unsubscribeTasks = onSnapshot(tasksQuery, (snapshot) => {
        const tasksList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AmaTask));
        setTasks(tasksList);
        save('ama_tasks', tasksList);
        setIsSyncing(false);
      }, (error) => {
        console.error('Real-time tasks sync failed:', error);
        setIsSyncing(false);
      });

      const unsubscribeEvents = onSnapshot(collection(db, 'users', user.id, 'events'), (snapshot) => {
        const eventsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AmaEvent));
        const email = localStorage.getItem('ama_gmail_email');
        const isConnected = localStorage.getItem('ama_calendar_connected') === 'true';
        if (email && isConnected) {
          fetch(`${API_BASE}/api/calendar/events?email=${encodeURIComponent(email)}`)
            .then(res => res.ok ? res.json() : null)
            .then(calData => {
              if (calData?.events) {
                const merged = [...eventsList, ...calData.events.filter(
                  (ce: AmaEvent) => !eventsList.find((e: AmaEvent) => e.id === ce.id)
                )];
                setEvents(merged);
                save('ama_events', merged);
              } else {
                setEvents(eventsList);
                save('ama_events', eventsList);
              }
            })
            .catch(() => {
              setEvents(eventsList);
              save('ama_events', eventsList);
            });
        } else {
          setEvents(eventsList);
          save('ama_events', eventsList);
        }
      }, (error) => {
        console.error('Real-time events sync failed:', error);
      });

      const unsubscribeMetrics = onSnapshot(collection(db, 'users', user.id, 'metrics'), (snapshot) => {
        const metricsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Metric));
        setMetrics(metricsList);
        save('ama_metrics', metricsList);
      }, (error) => {
        console.error('Real-time metrics sync failed:', error);
      });

      return () => {
        unsubscribeTasks();
        unsubscribeEvents();
        unsubscribeMetrics();
      };
    } else {
      // Fallback polling path
      syncFromBackendFallback();
      const interval = setInterval(syncFromBackendFallback, 60000);
      return () => clearInterval(interval);
    }
  }, [user?.id, syncFromBackendFallback]);

  // Persistent localStorage fallback updates
  useEffect(() => { save('ama_team', team); }, [team]);
  useEffect(() => { save('ama_events', events); }, [events]);
  useEffect(() => { save('ama_tasks', tasks); }, [tasks]);
  useEffect(() => { save('ama_metrics', metrics); }, [metrics]);

  // ── Events write handlers ───────────────────────────────────────────────────
  const addEvent = async (event: Omit<AmaEvent, 'id'>) => {
    if (!user?.id) return;
    
    const email = localStorage.getItem('ama_gmail_email');
    const isConnected = localStorage.getItem('ama_calendar_connected') === 'true';
    let eventId = `evt_${Date.now()}`;

    if (email && isConnected) {
      try {
        const res = await fetch(`${API_BASE}/api/calendar/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, ...event }),
        });
        const data = await res.json();
        if (data.success) {
          eventId = data.eventId;
        }
      } catch (e) {
        console.error('Failed to create Google Calendar event', e);
      }
    }

    if (db) {
      const newEvent: AmaEvent = { id: eventId, ...event };
      await setDoc(doc(db, 'users', user.id, 'events', eventId), newEvent);
    } else {
      // Fallback REST path
      try {
        const saved = await apiFetch('/api/events', {
          method: 'POST',
          body: JSON.stringify(event),
        });
        setEvents(prev => [...prev, saved]);
      } catch {
        const newEvent: AmaEvent = { id: eventId, ...event };
        setEvents(prev => [...prev, newEvent]);
      }
    }
  };

  const updateEvent = async (id: string, data: Partial<AmaEvent>) => {
    if (!user?.id) return;
    if (db) {
      await setDoc(doc(db, 'users', user.id, 'events', id), data, { merge: true });
    } else {
      setEvents(prev => prev.map(e => e.id === id ? { ...e, ...data } : e));
      try { await apiFetch(`/api/events/${id}`, { method: 'PUT', body: JSON.stringify(data) }); } catch {}
    }
  };

  const deleteEvent = async (id: string) => {
    if (!user?.id) return;
    if (db) {
      await deleteDoc(doc(db, 'users', user.id, 'events', id));
    } else {
      setEvents(prev => prev.filter(e => e.id !== id));
      try { await apiFetch(`/api/events/${id}`, { method: 'DELETE' }); } catch {}
    }
  };

  // ── Tasks write handlers ────────────────────────────────────────────────────
  const addTask = async (task: Omit<AmaTask, 'id' | 'createdAt'>) => {
    if (!user?.id) return;
    const taskId = `task_${Date.now()}`;
    const newTask: AmaTask = {
      id: taskId,
      createdAt: new Date().toISOString(),
      ...task
    };

    if (db) {
      await setDoc(doc(db, 'users', user.id, 'tasks', taskId), newTask);
    } else {
      try {
        const saved = await apiFetch('/api/tasks', { method: 'POST', body: JSON.stringify(task) });
        setTasks(prev => [...prev, saved]);
      } catch {
        setTasks(prev => [...prev, newTask]);
      }
    }
  };

  const updateTask = async (id: string, data: Partial<AmaTask>) => {
    if (!user?.id) return;
    if (db) {
      await setDoc(doc(db, 'users', user.id, 'tasks', id), data, { merge: true });
    } else {
      setTasks(prev => prev.map(t => t.id === id ? { ...t, ...data } : t));
      try { await apiFetch(`/api/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }); } catch {}
    }
  };

  const deleteTask = async (id: string) => {
    if (!user?.id) return;
    if (db) {
      await deleteDoc(doc(db, 'users', user.id, 'tasks', id));
    } else {
      setTasks(prev => prev.filter(t => t.id !== id));
      try { await apiFetch(`/api/tasks/${id}`, { method: 'DELETE' }); } catch {}
    }
  };

  // ── Team write handlers ─────────────────────────────────────────────────────
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

  // ── Metrics write handlers ──────────────────────────────────────────────────
  const addMetric = async (metric: Omit<Metric, 'id' | 'updatedAt'>) => {
    if (!user?.id) return;
    const metricId = `metric_${Date.now()}`;
    const newMetric: Metric = { id: metricId, updatedAt: new Date().toISOString(), ...metric };

    if (db) {
      await setDoc(doc(db, 'users', user.id, 'metrics', metricId), newMetric);
    } else {
      try {
        const saved = await apiFetch('/api/metrics', { method: 'POST', body: JSON.stringify(metric) });
        setMetrics(prev => [...prev, saved]);
      } catch {
        setMetrics(prev => [...prev, newMetric]);
      }
    }
  };

  const updateMetric = async (id: string, data: Partial<Metric>) => {
    if (!user?.id) return;
    if (db) {
      await setDoc(doc(db, 'users', user.id, 'metrics', id), {
        ...data,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } else {
      setMetrics(prev => prev.map(m => m.id === id ? { ...m, ...data, updatedAt: new Date().toISOString() } : m));
      try { await apiFetch(`/api/metrics/${id}`, { method: 'PUT', body: JSON.stringify(data) }); } catch {}
    }
  };

  const deleteMetric = async (id: string) => {
    if (!user?.id) return;
    if (db) {
      await deleteDoc(doc(db, 'users', user.id, 'metrics', id));
    } else {
      setMetrics(prev => prev.filter(m => m.id !== id));
      try { await apiFetch(`/api/metrics/${id}`, { method: 'DELETE' }); } catch {}
    }
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
