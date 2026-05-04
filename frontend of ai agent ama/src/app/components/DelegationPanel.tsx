import { Users, CheckCircle, Clock, ArrowRight } from 'lucide-react';

interface DelegatedTask {
  id: string;
  task: string;
  delegatedTo: string;
  delegatedBy: 'AI' | 'User';
  status: 'pending' | 'in-progress' | 'completed';
  dueDate: string;
  tool?: string;
}

const delegatedTasks: DelegatedTask[] = [
  {
    id: '1',
    task: 'Send follow-up email to John about proposal',
    delegatedTo: 'Email Manager (AI)',
    delegatedBy: 'AI',
    status: 'completed',
    dueDate: 'Today',
    tool: 'Gmail',
  },
  {
    id: '2',
    task: 'Schedule product review meeting',
    delegatedTo: 'Calendar Agent (AI)',
    delegatedBy: 'AI',
    status: 'completed',
    dueDate: 'Today',
    tool: 'Google Calendar',
  },
  {
    id: '3',
    task: 'Create Jira ticket for new feature request',
    delegatedTo: 'Task Agent (AI)',
    delegatedBy: 'User',
    status: 'in-progress',
    dueDate: 'Today',
    tool: 'Jira',
  },
  {
    id: '4',
    task: 'Post team update in #engineering channel',
    delegatedTo: 'Sarah Chen (Engineering Lead)',
    delegatedBy: 'AI',
    status: 'pending',
    dueDate: 'Tomorrow',
    tool: 'Slack',
  },
  {
    id: '5',
    task: 'Review and approve marketing budget',
    delegatedTo: 'Marcus Rodriguez (VP Marketing)',
    delegatedBy: 'User',
    status: 'in-progress',
    dueDate: 'May 2',
  },
];

export function DelegationPanel() {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-700';
      case 'in-progress':
        return 'bg-blue-100 text-blue-700';
      case 'pending':
        return 'bg-orange-100 text-orange-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'in-progress':
        return <Clock className="w-4 h-4 animate-spin" style={{ animationDuration: '3s' }} />;
      case 'pending':
        return <Clock className="w-4 h-4" />;
      default:
        return null;
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-2xl">Task Delegation</h3>
          <p className="text-slate-600">AI has autonomously delegated {delegatedTasks.length} tasks</p>
        </div>
      </div>

      <div className="space-y-3">
        {delegatedTasks.map((task) => (
          <div
            key={task.id}
            className="bg-white p-5 rounded-xl border border-slate-200 hover:shadow-md transition-all"
          >
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <div className="flex items-start justify-between mb-3">
                  <h4 className="font-medium text-slate-800">{task.task}</h4>
                  <span className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm ${getStatusColor(task.status)}`}>
                    {getStatusIcon(task.status)}
                    {task.status.replace('-', ' ')}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-sm mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">Delegated to:</span>
                    <span className="font-medium text-slate-700">{task.delegatedTo}</span>
                  </div>
                  {task.tool && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500">Via:</span>
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">{task.tool}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">Due:</span>
                    <span className="text-slate-700">{task.dueDate}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {task.delegatedBy === 'AI' ? (
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs flex items-center gap-1">
                        <span>🤖</span>
                        Auto-delegated
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs">
                        Manual delegation
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 bg-blue-50 border border-blue-200 p-6 rounded-xl">
        <div className="flex items-start gap-3">
          <Users className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
          <div>
            <h4 className="font-medium text-blue-900 mb-2">How AI Delegation Works</h4>
            <div className="space-y-2 text-sm text-blue-800">
              <div className="flex items-center gap-2">
                <ArrowRight className="w-4 h-4" />
                <span>AI analyzes incoming tasks from email, Slack, and meetings</span>
              </div>
              <div className="flex items-center gap-2">
                <ArrowRight className="w-4 h-4" />
                <span>Determines best person or tool to handle each task</span>
              </div>
              <div className="flex items-center gap-2">
                <ArrowRight className="w-4 h-4" />
                <span>Delegates with context and deadline automatically</span>
              </div>
              <div className="flex items-center gap-2">
                <ArrowRight className="w-4 h-4" />
                <span>Tracks progress and sends reminders if needed</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
