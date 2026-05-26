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

// ── localStorage helpers (fallback/resilience) ───────────────────────────────────
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

// ── Provider ───────────────────────────────────────────────────────────────────
export function AppProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  
  const [events, setEvents] = useState<AmaEvent[]>(() => load('ama_events', []));
  const [tasks, setTasks] = useState<AmaTask[]>(() => load('ama_tasks', []));
  const [team, setTeam] = useState<TeamMember[]>(() => load('ama_team', []));
  const [metrics, setMetrics] = useState<Metric[]>(() => load('ama_metrics', []));
  const [isSyncing, setIsSyncing] = useState(false);

  // ── Synchronize Tasks & Events in Real-Time via Firestore ───────────────────────
  useEffect(() => {
    if (!user?.id) {
      // Clear user data upon logout
      setTasks([]);
      setEvents([]);
      return;
    }

    setIsSyncing(true);

    // 1. Listen to user specific Tasks collection `/users/{uid}/tasks`
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

    // 2. Listen to user specific Events collection `/users/{uid}/events`
    const unsubscribeEvents = onSnapshot(collection(db, 'users', user.id, 'events'), (snapshot) => {
      const eventsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AmaEvent));

      // Merging with Google Calendar events if connected
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

    // 3. Listen to user specific Metrics collection `/users/{uid}/metrics`
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
  }, [user?.id]);

  // Keep other local lists persistent in localStorage
  useEffect(() => { save('ama_team', team); }, [team]);

  // ── Events write handlers ───────────────────────────────────────────────────
  const addEvent = async (event: Omit<AmaEvent, 'id'>) => {
    if (!user?.id) return;
    
    const email = localStorage.getItem('ama_gmail_email');
    const isConnected = localStorage.getItem('ama_calendar_connected') === 'true';

    let eventId = `evt_${Date.now()}`;

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
          eventId = data.eventId;
        }
      } catch (e) {
        console.error('Failed to create Google Calendar event', e);
      }
    }

    const newEvent: AmaEvent = { id: eventId, ...event };
    await setDoc(doc(db, 'users', user.id, 'events', eventId), newEvent);
  };

  const updateEvent = async (id: string, data: Partial<AmaEvent>) => {
    if (!user?.id) return;
    await setDoc(doc(db, 'users', user.id, 'events', id), data, { merge: true });
  };

  const deleteEvent = async (id: string) => {
    if (!user?.id) return;
    await deleteDoc(doc(db, 'users', user.id, 'events', id));
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
    await setDoc(doc(db, 'users', user.id, 'tasks', taskId), newTask);
  };

  const updateTask = async (id: string, data: Partial<AmaTask>) => {
    if (!user?.id) return;
    await setDoc(doc(db, 'users', user.id, 'tasks', id), data, { merge: true });
  };

  const deleteTask = async (id: string) => {
    if (!user?.id) return;
    await deleteDoc(doc(db, 'users', user.id, 'tasks', id));
  };

  // ── Team write handlers (local for now) ──────────────────────────────────────
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
    const newMetric: Metric = {
      id: metricId,
      updatedAt: new Date().toISOString(),
      ...metric
    };
    await setDoc(doc(db, 'users', user.id, 'metrics', metricId), newMetric);
  };

  const updateMetric = async (id: string, data: Partial<Metric>) => {
    if (!user?.id) return;
    await setDoc(doc(db, 'users', user.id, 'metrics', id), {
      ...data,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  };

  const deleteMetric = async (id: string) => {
    if (!user?.id) return;
    await deleteDoc(doc(db, 'users', user.id, 'metrics', id));
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
