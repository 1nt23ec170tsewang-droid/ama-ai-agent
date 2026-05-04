import { BarChart3, TrendingUp, TrendingDown, Minus, CheckCircle, Clock, Users, Calendar } from 'lucide-react';
import { useApp } from '../context/AppContext';

export function WeeklyInsights() {
  const { tasks, events, team } = useApp();

  const pendingTasks = tasks.filter(t => !t.completed);
  const completedTasks = tasks.filter(t => t.completed);
  const overdueTasks = pendingTasks.filter(t => {
    if (!t.dueDate) return false;
    return new Date(t.dueDate) < new Date(new Date().toDateString());
  });

  const todayISO = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
  const todayEvents = events.filter(e => (e.date || todayISO) === todayISO);
  const upcomingEvents = events.filter(e => (e.date || todayISO) > todayISO);

  const autoMetrics = [
    {
      id: 'm1',
      label: 'Pending Tasks',
      value: pendingTasks.length.toString(),
      unit: '',
      trend: pendingTasks.length > 5 ? 'down' : 'neutral',
      color: 'text-orange-600 bg-orange-50 border-orange-200',
      icon: <CheckCircle className="w-5 h-5 text-orange-500" />,
    },
    {
      id: 'm2',
      label: 'Completed Tasks',
      value: completedTasks.length.toString(),
      unit: '',
      trend: completedTasks.length > 0 ? 'up' : 'neutral',
      color: 'text-green-600 bg-green-50 border-green-200',
      icon: <TrendingUp className="w-5 h-5 text-green-500" />,
    },
    {
      id: 'm3',
      label: 'Overdue Tasks',
      value: overdueTasks.length.toString(),
      unit: '',
      trend: overdueTasks.length > 0 ? 'down' : 'neutral',
      color: 'text-red-600 bg-red-50 border-red-200',
      icon: <TrendingDown className="w-5 h-5 text-red-500" />,
    },
    {
      id: 'm4',
      label: 'Events Today',
      value: todayEvents.length.toString(),
      unit: '',
      trend: 'neutral',
      color: 'text-blue-600 bg-blue-50 border-blue-200',
      icon: <Clock className="w-5 h-5 text-blue-500" />,
    },
    {
      id: 'm5',
      label: 'Upcoming Events',
      value: upcomingEvents.length.toString(),
      unit: '',
      trend: 'up',
      color: 'text-indigo-600 bg-indigo-50 border-indigo-200',
      icon: <Calendar className="w-5 h-5 text-indigo-500" />,
    },
    {
      id: 'm6',
      label: 'Team Size',
      value: team.length.toString(),
      unit: 'members',
      trend: 'neutral',
      color: 'text-purple-600 bg-purple-50 border-purple-200',
      icon: <Users className="w-5 h-5 text-purple-500" />,
    }
  ];

  const periodLabel = (() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 6);
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  })();

  return (
    <div className="p-4 md:p-8 h-full overflow-auto bg-slate-50">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-orange-600" />
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Analytics</h1>
          </div>
        </div>
        <p className="text-slate-500 text-sm mb-8">Auto-generated performance data: {periodLabel}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
          {autoMetrics.map(metric => (
            <div
              key={metric.id}
              className={`bg-white rounded-xl border shadow-sm p-6 hover:shadow-md transition-all group ${metric.color}`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-2 bg-white rounded-lg shadow-sm">
                  {metric.icon}
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 bg-white/60 rounded-full">
                  {metric.trend === 'up' && <TrendingUp className="w-3.5 h-3.5" />}
                  {metric.trend === 'down' && <TrendingDown className="w-3.5 h-3.5" />}
                  {metric.trend === 'neutral' && <Minus className="w-3.5 h-3.5" />}
                  <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                    {metric.trend}
                  </span>
                </div>
              </div>
              <div className="mb-2">
                <span className="text-4xl font-extrabold tracking-tight">
                  {metric.value}
                </span>
                {metric.unit && (
                  <span className="text-sm ml-1.5 opacity-80 font-medium">{metric.unit}</span>
                )}
              </div>
              <p className="text-sm font-semibold opacity-90 truncate">{metric.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
