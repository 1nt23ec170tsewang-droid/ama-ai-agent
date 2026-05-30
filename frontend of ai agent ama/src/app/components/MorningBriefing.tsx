import { useState, useEffect } from 'react';
import { Sun, Calendar, Mail, CheckSquare, Sparkles, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { useSettings } from '../context/SettingsContext';
import { API_BASE } from '../utils/config';

interface BriefingData {
  executiveSummary: string;
  keyRisks: string[];
  strategicFocus: string;
  successMetric: string;
}

const getTimeBasedGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
};

const todayLabel = new Date().toLocaleDateString('en-US', {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
});

export function MorningBriefing() {
  const { user, token } = useAuth();
  const { profile } = useSettings();
  const { tasks, events } = useApp();
  const { showToast, removeToast } = useToast();
  
  const [briefing, setBriefing] = useState<BriefingData | null>(() => {
    try {
      const cached = localStorage.getItem('ama_morning_briefing_json');
      if (!cached) return null;
      const parsed = JSON.parse(cached);
      if (parsed && typeof parsed === 'object' && parsed.executiveSummary) {
        return parsed as BriefingData;
      }
      return null;
    } catch {
      return null;
    }
  });
  const [generating, setGenerating] = useState(false);
  const [timeString, setTimeString] = useState('');

  // Live HH:MM:SS clock
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setTimeString(now.toLocaleTimeString('en-US', { hour12: true }));
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  const displayName = profile?.name || user?.name || '';
  const firstName = displayName.split(' ')[0] || 'there';

  const pendingTasks = tasks.filter(t => !t.completed);
  const overdueTasks = pendingTasks.filter(t => {
    if (!t.dueDate) return false;
    return new Date(t.dueDate) < new Date(new Date().toDateString());
  });
  const todayEvents = events.filter(e => {
    if (!e.date) return true;
    return e.date === new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
  });
  const highPriorityTasks = pendingTasks.filter(t => t.priority === 'high').slice(0, 3);
  const todayISO = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
  const upcomingEvents = events.filter(e => e.date && e.date > todayISO).sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));

  const handleGenerate = async (regenerate = false) => {
    setGenerating(true);
    const toastId = showToast('Preparing your strategic morning briefing…', 'loading');
    
    try {
      const res = await fetch(`${API_BASE}/api/ama/briefing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ date: todayLabel, regenerate: !!regenerate })
      });
      
      if (!res.ok) throw new Error('API request failed');
      const data = await res.json();
      
      setBriefing(data.briefing);
      localStorage.setItem('ama_morning_briefing_json', JSON.stringify(data.briefing));
      showToast('Briefing ready!', 'success');
    } catch (err) {
      console.warn('Backend API briefing failed, falling back to local fallback:', err);
      showToast('Backend offline. Displaying simulated briefing.', 'warning');
      const fallbackData = {
        executiveSummary: "Today's agenda focuses heavily on core priorities and closing outstanding items. Keep meetings aligned to the afternoon slot to maximize productivity.",
        keyRisks: [
          "Potential overlap in calendar timelines during midday syncs.",
          "Uncommitted changes in high priority deliverables."
        ],
        strategicFocus: "Protect early morning focus hours for deep task execution.",
        successMetric: "Complete all high-priority deliverables successfully."
      };
      setBriefing(fallbackData);
      localStorage.setItem('ama_morning_briefing_json', JSON.stringify(fallbackData));
    } finally {
      removeToast(toastId);
      setGenerating(false);
    }
  };

  return (
    <div className="
      p-4 md:p-8 h-full overflow-auto
      bg-gradient-to-br from-orange-50 to-amber-50
      dark:from-slate-900 dark:to-slate-800
     font-sans">
      <div className="max-w-4xl mx-auto">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="mb-6 md:mb-8">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
            <div className="flex-1 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Sun className="w-8 h-8 text-orange-500 dark:text-amber-400 flex-shrink-0 animate-pulse" />
                <div>
                  <h1 className="text-2xl md:text-4xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">
                    {getTimeBasedGreeting()}, {firstName}
                  </h1>
                  <p className="text-slate-600 dark:text-slate-400 text-sm md:text-base mt-0.5 font-medium">
                    {todayLabel}
                  </p>
                </div>
              </div>

              {/* Live ticking HH:MM:SS clock */}
              {timeString && (
                <div className="px-5 py-2.5 rounded-2xl border-2 border-orange-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center gap-2.5 shadow-sm">
                  <Clock className="w-5 h-5 text-orange-500 animate-spin" style={{ animationDuration: '6s' }} />
                  <span className="font-mono text-lg md:text-xl font-bold text-slate-800 dark:text-slate-100 tracking-wider">
                    {timeString}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="
            grid grid-cols-3 gap-2 md:gap-3 p-3 md:p-4 rounded-xl border shadow-sm
            bg-white dark:bg-slate-800
            border-orange-200 dark:border-slate-700
          ">
            <div className="text-center">
              <p className="text-xl md:text-2xl font-bold text-orange-600 dark:text-amber-400">
                {pendingTasks.length}
              </p>
              <p className="text-[10px] md:text-xs text-slate-600 dark:text-slate-400">
                Pending Tasks
              </p>
            </div>
            <div className="text-center border-x border-slate-200 dark:border-slate-700">
              <p className="text-xl md:text-2xl font-bold text-orange-600 dark:text-amber-400">
                {todayEvents.length}
              </p>
              <p className="text-[10px] md:text-xs text-slate-600 dark:text-slate-400">
                Events Today
              </p>
            </div>
            <div className="text-center">
              <p className={`text-xl md:text-2xl font-bold ${
                overdueTasks.length > 0
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-green-600 dark:text-green-400'
              }`}>
                {overdueTasks.length}
              </p>
              <p className="text-[10px] md:text-xs text-slate-600 dark:text-slate-400">
                Overdue
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">

          {/* ── AI Briefing Card ─────────────────────────────────────────── */}
          <div className="
            rounded-xl border shadow-sm p-6
            bg-white dark:bg-slate-800
            border-slate-200 dark:border-slate-700
          ">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-amber-500 animate-pulse" />
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                Ryve Strategic Briefing
              </h2>
            </div>

            {(!briefing || typeof briefing !== 'object' || !briefing.executiveSummary) && !generating && (
              <div className="text-center py-6">
                <p className="text-slate-500 dark:text-slate-400 mb-4 text-sm">
                  Click Generate to pull your cached morning briefing or build a fresh daily overview.
                </p>
                <button
                  id="generate-briefing-btn"
                  onClick={() => handleGenerate(false)}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl hover:from-amber-600 hover:to-orange-700 transition-all shadow-lg shadow-amber-500/30 font-medium mx-auto active:scale-95"
                >
                  <Sparkles className="w-4 h-4" />
                  Generate Briefing
                </button>
              </div>
            )}

            {generating && (
              <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 py-4 justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                <span className="text-sm font-medium">Ryve is preparing your briefing…</span>
              </div>
            )}

            {briefing && typeof briefing === 'object' && briefing.executiveSummary && !generating && (
              <div className="border-2 border-amber-500/20 rounded-2xl bg-gradient-to-br from-amber-500/[0.03] via-orange-500/[0.03] to-yellow-500/[0.03] p-5 shadow-sm overflow-hidden relative">
                {/* Ambient glow decoration */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl pointer-events-none" />
                
                <div className="space-y-6">
                  {/* Executive Summary */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-1.5">
                      <span>📋</span> Executive Summary
                    </h4>
                    <p className="text-slate-700 dark:text-slate-200 text-sm md:text-base leading-relaxed font-medium">
                      {briefing.executiveSummary || ''}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Key Risks */}
                    <div className="p-4 rounded-xl bg-red-500/[0.03] border border-red-500/10">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400 mb-2.5 flex items-center gap-1.5">
                        <span>⚠️</span> Key Risks
                      </h4>
                      <ul className="space-y-2">
                        {Array.isArray(briefing.keyRisks) && briefing.keyRisks.map((risk, idx) => (
                          <li key={idx} className="text-xs md:text-sm text-slate-600 dark:text-slate-300 flex items-start gap-2">
                            <span className="text-red-500 mt-1">•</span>
                            <span>{risk || ''}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Strategic Focus */}
                    <div className="p-4 rounded-xl bg-blue-500/[0.03] border border-blue-500/10">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-2.5 flex items-center gap-1.5">
                        <span>💡</span> Strategic Focus
                      </h4>
                      <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300 italic leading-relaxed">
                        "{briefing.strategicFocus || ''}"
                      </p>
                    </div>
                  </div>

                  {/* Success Metric */}
                  <div className="p-4 rounded-xl bg-green-500/[0.03] border border-green-500/10 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-green-600 dark:text-green-400 mb-1 flex items-center gap-1.5">
                        <span>🎯</span> Success Metric
                      </h4>
                      <p className="text-sm text-slate-700 dark:text-slate-200 font-bold">
                        {briefing.successMetric || ''}
                      </p>
                    </div>
                    <div className="px-3 py-1 bg-green-500/10 text-green-600 dark:text-green-400 rounded-full text-[10px] font-semibold border border-green-500/20 max-w-max">
                      Measurable Goal
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                  <span className="text-[10px] text-slate-400">Briefing retrieved from daily cache</span>
                  <button
                    onClick={() => handleGenerate(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 border border-amber-300 dark:border-amber-700 hover:border-amber-400 rounded-lg transition-all active:scale-95"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Regenerate
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── High Priority Tasks ────────────────────────────────────────── */}
          <div className="
            rounded-xl border shadow-sm p-6
            bg-white dark:bg-slate-800
            border-slate-200 dark:border-slate-700
          ">
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                High Priority Tasks
              </h2>
            </div>

            {highPriorityTasks.length === 0 ? (
              <div className="text-center py-8">
                <CheckSquare className="w-10 h-10 text-green-400 mx-auto mb-2" />
                <p className="text-slate-500 dark:text-slate-400 text-sm">
                  No high-priority tasks. You're on top of it! 🎉
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {highPriorityTasks.map((task, index) => (
                  <div
                    key={task.id}
                    className="flex items-start gap-3 p-4 rounded-lg border-2 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                  >
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0 bg-red-500 text-white">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-slate-900 dark:text-slate-100 mb-1 text-sm">
                        {task.title}
                      </h3>
                      {task.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {task.description}
                        </p>
                      )}
                      {task.dueDate && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-slate-500 dark:text-slate-400">
                          <Clock className="w-3 h-3" />
                          <span>Due: {task.dueDate}</span>
                        </div>
                      )}
                    </div>
                    <span className="px-2 py-1 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 text-xs font-medium rounded flex-shrink-0">
                      Urgent
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Today's Events ─────────────────────────────────────────────── */}
          <div className="
            rounded-xl border shadow-sm p-6
            bg-white dark:bg-slate-800
            border-slate-200 dark:border-slate-700
          ">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                Today's Events
              </h2>
            </div>

            {todayEvents.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-slate-500 dark:text-slate-400 text-sm">
                  No events scheduled. Add some via the Calendar.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {todayEvents.map(event => (
                  <div
                    key={event.id}
                    className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 hover:border-orange-300 dark:hover:border-orange-600 transition-colors bg-white dark:bg-slate-800/50"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm mb-1">
                          {event.title}
                        </h3>
                        <p className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {event.time} · {event.duration}
                        </p>
                        {event.location && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            📍 {event.location}
                          </p>
                        )}
                      </div>
                      {event.attendees > 0 && (
                        <span className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-1 rounded">
                          {event.attendees} attendees
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Overdue Alert ──────────────────────────────────────────────── */}
          {overdueTasks.length > 0 && (
            <div className="
              rounded-xl border shadow-sm p-6
              bg-red-50 dark:bg-red-900/20
              border-red-200 dark:border-red-800
            ">
              <div className="flex items-center gap-2 mb-4">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                <h2 className="text-xl font-semibold text-red-900 dark:text-red-300">
                  Overdue Tasks
                </h2>
              </div>
              <div className="space-y-2">
                {overdueTasks.slice(0, 5).map(task => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-white dark:bg-slate-800 border-red-200 dark:border-red-800"
                  >
                    <span className="text-sm text-slate-800 dark:text-slate-200 font-medium">
                      {task.title}
                    </span>
                    <span className="px-2 py-1 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 rounded text-xs font-medium">
                      Due: {task.dueDate}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Upcoming Events ────────────────────────────────────────────── */}
          {upcomingEvents.length > 0 && (
            <div className="
              rounded-xl border shadow-sm p-6
              bg-white dark:bg-slate-800
              border-slate-200 dark:border-slate-700
            ">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                  Upcoming Events
                </h2>
              </div>
              <div className="space-y-3">
                {upcomingEvents.slice(0, 5).map(event => (
                  <div
                    key={event.id}
                    className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 hover:border-blue-300 dark:hover:border-blue-600 transition-colors bg-white dark:bg-slate-800/50"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm mb-1">
                          {event.title}
                        </h3>
                        <p className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {event.date} · {event.time}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── All Pending Tasks ──────────────────────────────────────────── */}
          {pendingTasks.length > 0 && (
            <div className="
              rounded-xl border shadow-sm p-6
              bg-white dark:bg-slate-800
              border-slate-200 dark:border-slate-700
            ">
              <div className="flex items-center gap-2 mb-4">
                <CheckSquare className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                  All Pending Tasks
                </h2>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-2" style={{ scrollbarWidth: 'thin' }}>
                {pendingTasks.map(task => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80"
                  >
                    <div>
                      <span className="text-sm text-slate-800 dark:text-slate-200 font-medium">
                        {task.title}
                      </span>
                      {task.dueDate && (
                        <p className="text-[10px] text-slate-500 mt-0.5">Due: {task.dueDate}</p>
                      )}
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      task.priority === 'high' ? 'bg-red-100 text-red-700' :
                      task.priority === 'medium' ? 'bg-amber-100 text-amber-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {task.priority}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Empty state ────────────────────────────────────────────────── */}
          {pendingTasks.length === 0 && todayEvents.length === 0 && upcomingEvents.length === 0 && (
            <div className="
              rounded-xl border border-dashed p-10 text-center
              bg-white dark:bg-slate-800
              border-slate-300 dark:border-slate-600
            ">
              <Mail className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Your dashboard is empty
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Add tasks via <strong className="text-slate-700 dark:text-slate-200">Task Tracker</strong> and events via <strong className="text-slate-700 dark:text-slate-200">Calendar</strong> to see your briefing populate.
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
