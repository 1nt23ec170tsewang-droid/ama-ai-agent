import { AlertTriangle, Clock, Mail, FileText, Calendar, TrendingUp } from 'lucide-react';

interface Alert {
  id: string;
  type: 'warning' | 'info' | 'urgent';
  icon: any;
  title: string;
  message: string;
  action?: string;
  time: string;
}

const alerts: Alert[] = [
  {
    id: '1',
    type: 'urgent',
    icon: FileText,
    title: 'Missing Board Meeting Prep',
    message: 'You have a board meeting tomorrow at 9 AM but no prep document has been created yet.',
    action: 'Create Prep Doc',
    time: '2 hours ago',
  },
  {
    id: '2',
    type: 'warning',
    icon: Clock,
    title: 'Invoice Overdue',
    message: 'The consulting invoice from Acme Corp is overdue by 3 days ($15,000).',
    action: 'Review Invoice',
    time: '4 hours ago',
  },
  {
    id: '3',
    type: 'info',
    icon: Mail,
    title: 'Follow-up Needed',
    message: 'John has not replied to your proposal from April 25. Would you like me to send a follow-up?',
    action: 'Send Follow-up',
    time: '5 hours ago',
  },
  {
    id: '4',
    type: 'warning',
    icon: Calendar,
    title: 'Calendar Conflict',
    message: 'Your Thursday calendar is fully booked with no lunch break. Want me to protect 30 minutes?',
    action: 'Block Lunch Time',
    time: 'Yesterday',
  },
  {
    id: '5',
    type: 'info',
    icon: TrendingUp,
    title: 'Weekly Productivity Insight',
    message: 'You spent 60% of your time in meetings this week, up from 45% last week. Consider blocking focus time.',
    action: 'View Report',
    time: 'Yesterday',
  },
];

export function ProactiveAlerts() {
  const getAlertStyles = (type: string) => {
    switch (type) {
      case 'urgent':
        return 'bg-red-50 border-red-200';
      case 'warning':
        return 'bg-orange-50 border-orange-200';
      case 'info':
        return 'bg-blue-50 border-blue-200';
      default:
        return 'bg-slate-50 border-slate-200';
    }
  };

  const getIconColor = (type: string) => {
    switch (type) {
      case 'urgent':
        return 'text-red-600';
      case 'warning':
        return 'text-orange-600';
      case 'info':
        return 'text-blue-600';
      default:
        return 'text-slate-600';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-3xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">Proactive Alerts</h3>
          <p className="text-slate-600">Ryve is monitoring and flagging important items for you</p>
        </div>
        <button className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200">
          Mark All Read
        </button>
      </div>

      {alerts.map((alert) => {
        const Icon = alert.icon;
        return (
          <div
            key={alert.id}
            className={`p-6 border rounded-xl ${getAlertStyles(alert.type)} transition-all hover:shadow-md`}
          >
            <div className="flex items-start gap-4">
              <div className={`p-3 bg-white rounded-lg ${getIconColor(alert.type)}`}>
                <Icon className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-medium text-slate-900">{alert.title}</h4>
                  <span className="text-sm text-slate-500">{alert.time}</span>
                </div>
                <p className="text-slate-700 mb-4">{alert.message}</p>
                {alert.action && (
                  <div className="flex gap-2">
                    <button className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg hover:from-amber-600 hover:to-orange-700 shadow-lg transition-all">
                      {alert.action}
                    </button>
                    <button className="px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
