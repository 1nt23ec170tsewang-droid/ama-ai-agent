import { Clock, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useApp } from '../context/AppContext';

export function Dashboard() {
  const { tasks, events } = useApp();

  // Tasks Today
  const todayISO = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
  const pendingTasks = tasks.filter(t => !t.completed);
  const completedTasks = tasks.filter(t => t.completed);
  const urgentTasks = pendingTasks.filter(t => t.priority === 'high');
  
  // Events
  const todayEvents = events.filter(e => (e.date || todayISO) === todayISO)
    .sort((a, b) => {
      // sort by time roughly
      const timeA = a.time.toLowerCase();
      const timeB = b.time.toLowerCase();
      return timeA.localeCompare(timeB);
    });

  // Priority Items (High priority first, then medium)
  const priorityItems = [...pendingTasks]
    .sort((a, b) => {
      const pLevel = { high: 0, medium: 1, low: 2 };
      return pLevel[a.priority] - pLevel[b.priority];
    })
    .slice(0, 5); // top 5

  // Weekly dummy data for now (since we don't have historical tracking)
  const weekData = [
    { name: 'Mon', day: 'Mon', tasks: 2 },
    { name: 'Tue', day: 'Tue', tasks: 4 },
    { name: 'Wed', day: 'Wed', tasks: 3 },
    { name: 'Thu', day: 'Thu', tasks: 5 },
    { name: 'Fri', day: 'Fri', tasks: completedTasks.length || 1 },
  ];

  return (
    <div className="p-8 overflow-auto h-full bg-gradient-to-br from-slate-50 via-amber-50/30 to-orange-50/20">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h2 className="text-4xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent mb-2">Good morning!</h2>
          <p className="text-slate-600">Ama has prepared your daily briefing</p>
        </div>

        <div className="grid grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-lg border-2 border-emerald-200 hover:shadow-xl transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-700 font-medium">Tasks Today</span>
              <div className="p-2 bg-emerald-100 rounded-lg">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
            <p className="text-4xl font-bold text-slate-900">{tasks.length}</p>
            <p className="text-sm text-emerald-600 mt-1">{completedTasks.length} completed</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg border-2 border-amber-200 hover:shadow-xl transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-700 font-medium">Meetings Today</span>
              <div className="p-2 bg-amber-100 rounded-lg">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
            </div>
            <p className="text-4xl font-bold text-slate-900">{todayEvents.length}</p>
            <p className="text-sm text-amber-600 mt-1">
              {todayEvents.length > 0 ? `Next at ${todayEvents[0].time}` : 'No meetings today'}
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg border-2 border-orange-200 hover:shadow-xl transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-700 font-medium">Priorities</span>
              <div className="p-2 bg-orange-100 rounded-lg">
                <AlertCircle className="w-5 h-5 text-orange-600" />
              </div>
            </div>
            <p className="text-4xl font-bold text-slate-900">{pendingTasks.length}</p>
            <p className="text-sm text-orange-600 mt-1">{urgentTasks.length} urgent (high priority)</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg border-2 border-violet-200 hover:shadow-xl transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-700 font-medium">Productivity</span>
              <div className="p-2 bg-violet-100 rounded-lg">
                <TrendingUp className="w-5 h-5 text-violet-600" />
              </div>
            </div>
            <p className="text-4xl font-bold text-slate-900">
              {tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0}%
            </p>
            <p className="text-sm text-emerald-600 mt-1">Completion rate</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-lg border-2 border-slate-200 hover:shadow-xl transition-all">
            <h3 className="text-lg font-semibold mb-4 text-slate-800">Weekly Task Completion</h3>
            <ResponsiveContainer width="100%" height={200} key="dashboard-chart">
              <BarChart data={weekData} key="bar-chart-1">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" key="grid-1" />
                <XAxis dataKey="day" stroke="#64748b" key="xaxis-1" />
                <YAxis stroke="#64748b" key="yaxis-1" />
                <Tooltip key="tooltip-1" />
                <Bar dataKey="tasks" fill="url(#colorGradient)" radius={[8, 8, 0, 0]} isAnimationActive={false} key="bar-1" />
                <defs>
                  <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" />
                    <stop offset="100%" stopColor="#ea580c" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg border-2 border-slate-200 hover:shadow-xl transition-all">
            <h3 className="text-lg font-semibold mb-4 text-slate-800">Today's Schedule</h3>
            <div className="space-y-3">
              {todayEvents.length === 0 ? (
                <p className="text-sm text-slate-500 italic">No events scheduled for today.</p>
              ) : (
                todayEvents.map((meeting) => (
                  <div key={meeting.id} className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="text-sm font-medium text-slate-600 w-20">{meeting.time}</div>
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">{meeting.title}</p>
                      <p className="text-sm text-slate-500">{meeting.attendees} attendees</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-lg border-2 border-slate-200 hover:shadow-xl transition-all">
            <h3 className="text-lg font-semibold mb-4 text-slate-800">Pending Tasks (By Date)</h3>
            <div className="space-y-3">
              {pendingTasks.length === 0 ? (
                <p className="text-sm text-slate-500 italic">No pending tasks.</p>
              ) : (
                [...pendingTasks]
                  .sort((a, b) => {
                    if (!a.dueDate) return 1;
                    if (!b.dueDate) return -1;
                    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
                  })
                  .slice(0, 5)
                  .map((item) => (
                    <div key={item.id} className="flex items-center gap-4 p-4 border border-slate-200 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">{item.title}</p>
                        <p className="text-sm text-slate-500">Due: {item.dueDate || 'No date'}</p>
                      </div>
                      <span className={`px-2 py-1 text-xs rounded-lg uppercase font-semibold ${
                        item.priority === 'high' ? 'bg-red-100 text-red-700' :
                        item.priority === 'medium' ? 'bg-orange-100 text-orange-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {item.priority}
                      </span>
                    </div>
                  ))
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg border-2 border-red-200 hover:shadow-xl transition-all">
            <h3 className="text-lg font-semibold mb-4 text-slate-800">High Priority Tasks</h3>
            <div className="space-y-3">
              {urgentTasks.length === 0 ? (
                <p className="text-sm text-slate-500 italic">No urgent tasks.</p>
              ) : (
                urgentTasks.slice(0, 5).map((item) => (
                  <div key={item.id} className="flex items-center gap-4 p-4 border border-red-100 bg-red-50/50 rounded-lg">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">{item.title}</p>
                      <p className="text-sm text-red-500/80">Due: {item.dueDate || 'No date'}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
