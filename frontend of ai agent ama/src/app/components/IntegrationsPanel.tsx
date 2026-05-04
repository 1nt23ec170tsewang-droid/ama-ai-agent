import { CheckCircle, Circle, Settings } from 'lucide-react';

interface Integration {
  id: string;
  name: string;
  category: string;
  icon: string;
  connected: boolean;
  status: 'active' | 'disconnected' | 'error';
  lastSync?: string;
}

const integrations: Integration[] = [
  { id: '1', name: 'Gmail', category: 'Email', icon: '📧', connected: true, status: 'active', lastSync: '2 min ago' },
  { id: '2', name: 'Google Calendar', category: 'Calendar', icon: '📅', connected: true, status: 'active', lastSync: '5 min ago' },
  { id: '3', name: 'Slack', category: 'Messaging', icon: '💬', connected: true, status: 'active', lastSync: '1 min ago' },
  { id: '4', name: 'Notion', category: 'Docs & Notes', icon: '📝', connected: true, status: 'active', lastSync: '10 min ago' },
  { id: '5', name: 'Asana', category: 'Task Management', icon: '✅', connected: true, status: 'active', lastSync: '3 min ago' },
  { id: '6', name: 'Zoom', category: 'Video Calls', icon: '📞', connected: true, status: 'active', lastSync: '15 min ago' },
  { id: '7', name: 'Salesforce', category: 'CRM', icon: '💼', connected: false, status: 'disconnected' },
  { id: '8', name: 'HubSpot', category: 'CRM', icon: '🎯', connected: false, status: 'disconnected' },
  { id: '9', name: 'Linear', category: 'Task Management', icon: '🔷', connected: false, status: 'disconnected' },
  { id: '10', name: 'Microsoft Teams', category: 'Messaging', icon: '👥', connected: false, status: 'disconnected' },
];

export function IntegrationsPanel() {
  const connectedCount = integrations.filter(i => i.connected).length;

  return (
    <div>
      <div className="mb-8">
        <h3 className="text-3xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent mb-2">Integrations</h3>
        <p className="text-slate-600">
          Chief of Staff Ama is connected to {connectedCount} of {integrations.length} integrations
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {integrations.map((integration) => (
          <div
            key={integration.id}
            className={`p-6 rounded-xl border transition-all ${
              integration.connected
                ? 'bg-white border-green-200 hover:shadow-md'
                : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-2xl">
                {integration.icon}
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-medium text-slate-900">{integration.name}</h4>
                    <p className="text-sm text-slate-600">{integration.category}</p>
                  </div>
                  {integration.connected ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <Circle className="w-5 h-5 text-slate-400" />
                  )}
                </div>
                {integration.lastSync && (
                  <p className="text-xs text-slate-500 mb-3">Last synced: {integration.lastSync}</p>
                )}
                <div className="flex gap-2">
                  {integration.connected ? (
                    <>
                      <button className="flex items-center gap-1 px-3 py-1.5 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200">
                        <Settings className="w-3 h-3" />
                        Settings
                      </button>
                      <button className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg">
                        Disconnect
                      </button>
                    </>
                  ) : (
                    <button className="px-3 py-1.5 text-sm bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg hover:from-amber-600 hover:to-orange-700 shadow-lg">
                      Connect
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
