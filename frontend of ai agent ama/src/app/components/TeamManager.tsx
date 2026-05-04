import { useState } from 'react';
import {
  Users, MessageSquare, CheckSquare, X, Sparkles, TrendingUp,
  Target, Plus, Trash2, Edit2, Loader2
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { askClaude } from '../utils/claude';
import type { TeamMember } from '../context/AppContext';

const DEPARTMENTS = [
  'Engineering', 'Product', 'Design', 'Marketing', 'Sales',
  'Finance', 'Operations', 'HR', 'Legal', 'Leadership', 'Other',
];

const STATUS_COLORS: Record<TeamMember['status'], string> = {
  online: 'bg-green-500',
  away: 'bg-yellow-500',
  offline: 'bg-slate-400',
};
const STATUS_RINGS: Record<TeamMember['status'], string> = {
  online: 'ring-green-400',
  away: 'ring-yellow-400',
  offline: 'ring-slate-300',
};
const WORKLOAD_STYLES: Record<TeamMember['workload'], string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-green-100 text-green-700',
};
const PROGRESS_COLOR = (n: number) =>
  n >= 80 ? 'bg-green-500' : n >= 60 ? 'bg-yellow-500' : 'bg-red-500';

const EMPTY_FORM = {
  name: '', role: '', department: 'Engineering', email: '', phone: '',
  status: 'online' as TeamMember['status'],
  workload: 'medium' as TeamMember['workload'],
  taskCompletion: 0,
  currentKPI: '',
  tasksCompleted: 0,
  tasksTotal: 0,
  metrics: { productivity: 0, responseTime: '—', projectsActive: 0 },
};

export function TeamManager() {
  const { team, addTeamMember, updateTeamMember, deleteTeamMember } = useApp();
  const { showToast } = useToast();

  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const onlineCount = team.filter(m => m.status === 'online').length;
  const awayCount = team.filter(m => m.status === 'away').length;

  const handleSave = () => {
    if (!form.name.trim() || !form.role.trim()) {
      showToast('Name and Role are required', 'error');
      return;
    }
    if (isEditing && selectedMember) {
      updateTeamMember(selectedMember.id, { ...form });
      setSelectedMember({ ...selectedMember, ...form });
      showToast(`${form.name}'s profile updated!`, 'success');
    } else {
      addTeamMember({ ...form });
      showToast(`${form.name} added to the team!`, 'success');
    }
    setForm(EMPTY_FORM);
    setShowAddModal(false);
    setIsEditing(false);
  };

  const handleDelete = (member: TeamMember) => {
    deleteTeamMember(member.id);
    if (selectedMember?.id === member.id) setSelectedMember(null);
    showToast(`${member.name} removed`, 'info');
  };

  const generateAINote = async (member: TeamMember) => {
    setAiLoading(true);
    setAiNote(null);
    showToast('Generating performance insight…', 'loading');
    try {
      const prompt = `Generate a 2-sentence performance insight for ${member.name} (${member.role}) with:
- Task completion: ${member.taskCompletion}% (${member.tasksCompleted}/${member.tasksTotal} tasks)
- Current KPI focus: ${member.currentKPI || 'Not set'}
- Workload: ${member.workload}
- Productivity score: ${member.metrics.productivity}%
Be encouraging, specific, and professional.`;
      const result = await askClaude(prompt, 'You are Ama, an AI Chief of Staff. Write concise, actionable performance notes.');
      setAiNote(result);
      showToast('Insight generated!', 'success');
    } catch {
      showToast('Could not generate insight', 'error');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-8 h-full overflow-auto bg-slate-50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Users className="w-8 h-8 text-orange-600" />
              <h1 className="text-3xl font-bold text-slate-900">Team Manager</h1>
            </div>
            <p className="text-slate-600">Manage and monitor your team</p>
          </div>
          <button
            id="add-team-member-btn"
            onClick={() => { setForm(EMPTY_FORM); setIsEditing(false); setShowAddModal(true); }}
            className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-lg font-medium transition-colors shadow-lg"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden md:inline">Add Member</span>
          </button>
        </div>

        {/* Stats */}
        {team.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 bg-green-500 rounded-full" />
                <span className="text-sm font-medium text-slate-700">Online</span>
              </div>
              <p className="text-3xl font-bold text-green-600">{onlineCount}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                <span className="text-sm font-medium text-slate-700">Away</span>
              </div>
              <p className="text-3xl font-bold text-yellow-600">{awayCount}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-slate-600" />
                <span className="text-sm font-medium text-slate-700">Total</span>
              </div>
              <p className="text-3xl font-bold text-slate-900">{team.length}</p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {team.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-300">
            <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-700 mb-2">No team members yet</h3>
            <p className="text-sm text-slate-500 mb-6">
              Add your first team member to start tracking performance.
            </p>
            <button
              onClick={() => { setForm(EMPTY_FORM); setIsEditing(false); setShowAddModal(true); }}
              className="px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-medium shadow-lg hover:from-orange-600 hover:to-orange-700 transition-all"
            >
              + Add First Member
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {team.map(member => (
              <div
                key={member.id}
                onClick={() => { setSelectedMember(member); setAiNote(null); }}
                className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 hover:shadow-lg transition-all cursor-pointer hover:border-orange-300 group"
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="relative">
                    <div className={`w-14 h-14 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold text-lg ring-4 ${STATUS_RINGS[member.status]}`}>
                      {member.avatar}
                    </div>
                    <div className={`absolute bottom-0 right-0 w-4 h-4 ${STATUS_COLORS[member.status]} rounded-full border-2 border-white`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-900 truncate">{member.name}</h3>
                    <p className="text-sm text-slate-600 truncate">{member.role}</p>
                    {member.department && (
                      <p className="text-xs text-slate-400 truncate">{member.department}</p>
                    )}
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${WORKLOAD_STYLES[member.workload]}`}>
                      {member.workload.toUpperCase()} Workload
                    </span>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(member); }}
                    className="p-1.5 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {member.currentKPI && (
                  <div className="mb-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Target className="w-4 h-4 text-orange-600" />
                      <span className="text-xs font-medium text-slate-700">Current Focus</span>
                    </div>
                    <p className="text-sm text-slate-900 font-medium">{member.currentKPI}</p>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-slate-700">Task Progress</span>
                    <span className="text-xs font-bold text-slate-900">{member.taskCompletion}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div
                      className={`${PROGRESS_COLOR(member.taskCompletion)} h-2 rounded-full transition-all`}
                      style={{ width: `${member.taskCompletion}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {member.tasksCompleted} / {member.tasksTotal} tasks
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail Panel */}
      {selectedMember && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-auto">
            <div className="sticky top-0 bg-gradient-to-r from-orange-500 to-orange-600 p-6 rounded-t-2xl">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-2xl">
                    {selectedMember.avatar}
                  </div>
                  <div className="text-white">
                    <h2 className="text-2xl font-bold">{selectedMember.name}</h2>
                    <p className="text-orange-100">{selectedMember.role}</p>
                    {selectedMember.email && <p className="text-orange-200 text-sm">{selectedMember.email}</p>}
                  </div>
                </div>
                <button
                  onClick={() => { setSelectedMember(null); setAiNote(null); }}
                  className="p-2 hover:bg-white/20 rounded-lg"
                >
                  <X className="w-6 h-6 text-white" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Meta grid */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Status', value: selectedMember.status, icon: <div className={`w-3 h-3 ${STATUS_COLORS[selectedMember.status]} rounded-full`} /> },
                  { label: 'Workload', value: selectedMember.workload, icon: <TrendingUp className="w-3 h-3 text-slate-600" /> },
                  { label: 'KPI Focus', value: selectedMember.currentKPI || '—', icon: <Target className="w-3 h-3 text-slate-600" /> },
                  { label: 'Tasks', value: `${selectedMember.tasksCompleted}/${selectedMember.tasksTotal}`, icon: <CheckSquare className="w-3 h-3 text-slate-600" /> },
                ].map(cell => (
                  <div key={cell.label} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                    <div className="flex items-center gap-2 mb-1">
                      {cell.icon}
                      <span className="text-xs font-medium text-slate-600">{cell.label}</span>
                    </div>
                    <p className="font-semibold text-slate-900 capitalize">{cell.value}</p>
                  </div>
                ))}
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-2xl font-bold text-blue-600">{selectedMember.metrics.productivity}%</p>
                  <p className="text-xs text-blue-700">Productivity</p>
                </div>
                <div className="text-center p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <p className="text-lg font-bold text-purple-600">{selectedMember.metrics.responseTime}</p>
                  <p className="text-xs text-purple-700">Avg Response</p>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-2xl font-bold text-green-600">{selectedMember.metrics.projectsActive}</p>
                  <p className="text-xs text-green-700">Active Projects</p>
                </div>
              </div>

              {/* AI Insight */}
              <div className="p-4 bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg border border-purple-200">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                  <h3 className="text-sm font-semibold text-purple-900">AI Performance Insight</h3>
                </div>
                {!aiNote && !aiLoading && (
                  <button
                    id="generate-insight-btn"
                    onClick={() => generateAINote(selectedMember)}
                    className="w-full px-4 py-3 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    <Sparkles className="w-4 h-4" />
                    Generate Performance Note
                  </button>
                )}
                {aiLoading && (
                  <div className="flex items-center gap-2 text-slate-500 text-sm py-2">
                    <Loader2 className="w-4 h-4 animate-spin text-purple-500" /> Generating…
                  </div>
                )}
                {aiNote && (
                  <p className="text-sm text-slate-700 leading-relaxed">{aiNote}</p>
                )}
              </div>

              {/* Actions */}
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => {
                    setForm({
                      name: selectedMember.name, role: selectedMember.role, department: selectedMember.department,
                      email: selectedMember.email, phone: selectedMember.phone || '',
                      status: selectedMember.status, workload: selectedMember.workload,
                      taskCompletion: selectedMember.taskCompletion, currentKPI: selectedMember.currentKPI,
                      tasksCompleted: selectedMember.tasksCompleted, tasksTotal: selectedMember.tasksTotal,
                      metrics: selectedMember.metrics
                    });
                    setIsEditing(true);
                    setShowAddModal(true);
                  }}
                  className="flex flex-col items-center gap-2 p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                >
                  <Edit2 className="w-5 h-5 text-blue-600" />
                  <span className="text-xs font-medium text-blue-700">Edit Profile</span>
                </button>
                <button
                  onClick={() => {
                    if (selectedMember.phone) {
                      const cleanPhone = selectedMember.phone.replace(/\D/g, '');
                      window.open(`https://wa.me/${cleanPhone}`, '_blank');
                    } else {
                      showToast(`No phone number saved for ${selectedMember.name}. Edit profile to use WhatsApp.`, 'error');
                    }
                  }}
                  className="flex flex-col items-center gap-2 p-4 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                >
                  <MessageSquare className="w-5 h-5 text-green-600" />
                  <span className="text-xs font-medium text-green-700">WhatsApp Message</span>
                </button>
                <button
                  onClick={() => {
                    deleteTeamMember(selectedMember.id);
                    setSelectedMember(null);
                    showToast(`${selectedMember.name} removed`, 'info');
                  }}
                  className="flex flex-col items-center gap-2 p-4 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                >
                  <Trash2 className="w-5 h-5 text-red-600" />
                  <span className="text-xs font-medium text-red-600">Remove Member</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-auto">
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">{isEditing ? 'Edit Team Member' : 'Add Team Member'}</h2>
                <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-white/20 rounded-lg">
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
                <input
                  id="member-name-input"
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Full name"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                />
              </div>
              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Role *</label>
                <input
                  id="member-role-input"
                  type="text"
                  value={form.role}
                  onChange={e => setForm({ ...form, role: e.target.value })}
                  placeholder="e.g., VP Engineering"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                />
              </div>
              {/* Department */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
                <select
                  value={form.department}
                  onChange={e => setForm({ ...form, department: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                >
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              {/* Email & Phone */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    placeholder="member@company.com"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={e => setForm({ ...form, phone: e.target.value })}
                    placeholder="+1234567890"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                  />
                </div>
              </div>
              {/* KPI */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Current KPI / Focus</label>
                <input
                  type="text"
                  value={form.currentKPI}
                  onChange={e => setForm({ ...form, currentKPI: e.target.value })}
                  placeholder="e.g., Q2 Revenue Target"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                />
              </div>
              {/* Status & Workload */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={e => setForm({ ...form, status: e.target.value as TeamMember['status'] })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                  >
                    <option value="online">Online</option>
                    <option value="away">Away</option>
                    <option value="offline">Offline</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Workload</label>
                  <select
                    value={form.workload}
                    onChange={e => setForm({ ...form, workload: e.target.value as TeamMember['workload'] })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
              {/* Task stats */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Completed</label>
                  <input
                    type="number" min="0"
                    value={form.tasksCompleted}
                    onChange={e => {
                      const comp = +e.target.value;
                      const tot = form.tasksTotal;
                      const pct = tot > 0 ? Math.round((comp / tot) * 100) : 0;
                      setForm({ ...form, tasksCompleted: comp, taskCompletion: pct, metrics: { ...form.metrics, productivity: pct } });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Total</label>
                  <input
                    type="number" min="0"
                    value={form.tasksTotal}
                    onChange={e => {
                      const tot = +e.target.value;
                      const comp = form.tasksCompleted;
                      const pct = tot > 0 ? Math.round((comp / tot) * 100) : 0;
                      setForm({ ...form, tasksTotal: tot, taskCompletion: pct, metrics: { ...form.metrics, productivity: pct } });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">% Complete</label>
                  <input
                    type="number" min="0" max="100"
                    value={form.taskCompletion}
                    readOnly
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-100 text-slate-500 text-sm cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  id="submit-add-member-btn"
                  onClick={handleSave}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-lg font-medium transition-colors shadow-lg"
                >
                  {isEditing ? 'Save Changes' : 'Add Member'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
