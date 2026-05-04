import { TrendingUp, TrendingDown, Calendar, CheckCircle, Clock, AlertTriangle, Target } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const weeklyData = [
  { name: 'Mon', day: 'Mon', meetings: 4, focusTime: 3, email: 2 },
  { name: 'Tue', day: 'Tue', meetings: 6, focusTime: 2, email: 3 },
  { name: 'Wed', day: 'Wed', meetings: 3, focusTime: 5, email: 2 },
  { name: 'Thu', day: 'Thu', meetings: 7, focusTime: 1, email: 2 },
  { name: 'Fri', day: 'Fri', meetings: 4, focusTime: 4, email: 1 },
];

const timeDistribution = [
  { id: 'meetings', name: 'Meetings', value: 24, color: '#3b82f6' },
  { id: 'focus', name: 'Focus Work', value: 15, color: '#10b981' },
  { id: 'email', name: 'Email', value: 10, color: '#f59e0b' },
  { id: 'admin', name: 'Admin', value: 5, color: '#6366f1' },
];

const completionData = [
  { name: 'Week 1', week: 'Week 1', completed: 45, pending: 12 },
  { name: 'Week 2', week: 'Week 2', completed: 52, pending: 8 },
  { name: 'Week 3', week: 'Week 3', completed: 48, pending: 15 },
  { name: 'Week 4', week: 'Week 4', completed: 61, pending: 7 },
];

const insights = [
  {
    id: '1',
    type: 'positive',
    icon: TrendingUp,
    title: 'Task Completion Up 23%',
    description: 'You completed 61 tasks this week vs. 48 last week',
  },
  {
    id: '2',
    type: 'warning',
    icon: AlertTriangle,
    title: 'Meeting Load High',
    description: 'You spent 45% of your time in meetings. Consider blocking more focus time.',
  },
  {
    id: '3',
    type: 'positive',
    icon: CheckCircle,
    title: 'Email Response Time Improved',
    description: 'Average response time down from 4.2 hours to 2.1 hours',
  },
  {
    id: '4',
    type: 'neutral',
    icon: Clock,
    title: 'Focus Time Decreased',
    description: 'Deep work hours down 12% this week due to additional meetings',
  },
];

const topAccomplishments = [
  { id: '1', text: 'Closed Q2 budget planning with all departments' },
  { id: '2', text: 'Hired Senior Engineering Manager (Jane Smith)' },
  { id: '3', text: 'Launched new product feature to beta customers' },
  { id: '4', text: 'Completed board meeting presentation deck' },
  { id: '5', text: 'Signed partnership agreement with Acme Corp' },
];

const bottlenecks = [
  { id: '1', task: 'Marketing campaign approval', blockedBy: 'Waiting on legal review', days: 5 },
  { id: '2', task: 'Engineering headcount increase', blockedBy: 'Budget approval pending', days: 8 },
  { id: '3', task: 'Customer onboarding automation', blockedBy: 'Dev resources unavailable', days: 12 },
];

export function WeeklyReport() {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-red-600 text-white p-8 rounded-xl shadow-2xl">
        <h2 className="text-3xl font-bold mb-2">Weekly Wrap by Ama</h2>
        <p className="text-amber-100 mb-4">April 24 - April 30, 2026</p>
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg">
            <div className="text-2xl font-bold">61</div>
            <div className="text-sm text-purple-100">Tasks Completed</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg">
            <div className="text-2xl font-bold">24</div>
            <div className="text-sm text-purple-100">Meetings Attended</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg">
            <div className="text-2xl font-bold">15h</div>
            <div className="text-sm text-purple-100">Focus Time</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg">
            <div className="text-2xl font-bold">94%</div>
            <div className="text-sm text-purple-100">On-Time Completion</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200">
          <h3 className="text-lg font-medium mb-4">Time Distribution (Hours)</h3>
          <ResponsiveContainer width="100%" height={250} key="pie-container">
            <PieChart key="pie-chart-1">
              <Pie
                data={timeDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}h`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                isAnimationActive={false}
                key="pie-1"
              >
                {timeDistribution.map((entry) => (
                  <Cell key={entry.id} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip key="pie-tooltip-1" />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200">
          <h3 className="text-lg font-medium mb-4">Daily Time Breakdown</h3>
          <ResponsiveContainer width="100%" height={250} key="bar-container">
            <BarChart data={weeklyData} key="bar-chart-2">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" key="grid-2" />
              <XAxis dataKey="day" stroke="#64748b" key="xaxis-2" />
              <YAxis stroke="#64748b" key="yaxis-2" />
              <Tooltip key="tooltip-2" />
              <Legend key="legend-2" />
              <Bar dataKey="meetings" fill="#3b82f6" name="Meetings" stackId="a" isAnimationActive={false} key="bar-2a" />
              <Bar dataKey="focusTime" fill="#10b981" name="Focus Time" stackId="a" isAnimationActive={false} key="bar-2b" />
              <Bar dataKey="email" fill="#f59e0b" name="Email" stackId="a" isAnimationActive={false} key="bar-2c" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200">
        <h3 className="text-lg font-medium mb-4">Task Completion Trend</h3>
        <ResponsiveContainer width="100%" height={200} key="line-container">
          <LineChart data={completionData} key="line-chart-3">
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" key="grid-3" />
            <XAxis dataKey="week" stroke="#64748b" key="xaxis-3" />
            <YAxis stroke="#64748b" key="yaxis-3" />
            <Tooltip key="tooltip-3" />
            <Legend key="legend-3" />
            <Line type="monotone" dataKey="completed" stroke="#10b981" strokeWidth={2} name="Completed" isAnimationActive={false} key="line-3a" />
            <Line type="monotone" dataKey="pending" stroke="#f59e0b" strokeWidth={2} name="Pending" isAnimationActive={false} key="line-3b" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200">
          <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-green-600" />
            Top Accomplishments
          </h3>
          <div className="space-y-2">
            {topAccomplishments.map((item) => (
              <div key={item.id} className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-slate-700">{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200">
          <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-600" />
            Current Bottlenecks
          </h3>
          <div className="space-y-3">
            {bottlenecks.map((item) => (
              <div key={item.id} className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-start justify-between mb-1">
                  <span className="font-medium text-slate-800 text-sm">{item.task}</span>
                  <span className="text-xs text-orange-700 bg-orange-100 px-2 py-0.5 rounded">{item.days} days</span>
                </div>
                <span className="text-sm text-slate-600">{item.blockedBy}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200">
        <h3 className="text-lg font-medium mb-4">Key Insights & Recommendations</h3>
        <div className="grid grid-cols-2 gap-4">
          {insights.map((insight) => {
            const Icon = insight.icon;
            return (
              <div
                key={insight.id}
                className={`p-4 rounded-lg border ${
                  insight.type === 'positive' ? 'bg-green-50 border-green-200' :
                  insight.type === 'warning' ? 'bg-orange-50 border-orange-200' :
                  'bg-blue-50 border-blue-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  <Icon className={`w-5 h-5 mt-0.5 ${
                    insight.type === 'positive' ? 'text-green-600' :
                    insight.type === 'warning' ? 'text-orange-600' :
                    'text-blue-600'
                  }`} />
                  <div>
                    <h4 className="font-medium text-slate-800 mb-1">{insight.title}</h4>
                    <p className="text-sm text-slate-600">{insight.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
