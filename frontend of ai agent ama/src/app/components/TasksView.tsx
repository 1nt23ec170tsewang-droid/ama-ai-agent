import { useState, useMemo } from 'react';
import { Plus, Search, CheckCircle2, Circle, Trash2, Sparkles, Loader2, X, Brain } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { askClaude } from '../utils/claude';
import type { AmaTask } from '../context/AppContext';

type KanbanStatus = 'todo' | 'in-progress' | 'done';

const COLUMNS: { id: KanbanStatus; label: string; color: string; bg: string }[] = [
  { id: 'todo',        label: 'To Do',       color: 'text-slate-600', bg: 'bg-slate-100' },
  { id: 'in-progress', label: 'In Progress', color: 'text-blue-600',  bg: 'bg-blue-50'   },
  { id: 'done',        label: 'Done',        color: 'text-green-600', bg: 'bg-green-50'  },
];

const PRIORITY_STYLES: Record<string, string> = {
  high:   'bg-red-100 text-red-700 border-red-300',
  medium: 'bg-orange-100 text-orange-700 border-orange-300',
  low:    'bg-blue-100 text-blue-700 border-blue-300',
};

const PRIORITY_BORDER: Record<string, string> = {
  high:   'border-l-red-500',
  medium: 'border-l-orange-500',
  low:    'border-l-blue-500',
};

function TaskCard({
  task,
  onToggle,
  onDelete,
  onMove,
}: {
  task: AmaTask;
  onToggle: () => void;
  onDelete: () => void;
  onMove: (status: KanbanStatus) => void;
}) {
  return (
    <div className={`bg-white rounded-lg border-l-4 ${PRIORITY_BORDER[task.priority]} border border-slate-200 p-3 shadow-sm hover:shadow-md transition-all group`}>
      <div className="flex items-start gap-2">
        <button onClick={onToggle} className="mt-0.5 flex-shrink-0">
          {task.completed
            ? <CheckCircle2 className="w-5 h-5 text-green-600" />
            : <Circle className="w-5 h-5 text-slate-400 hover:text-slate-600" />}
        </button>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium mb-1 ${task.completed ? 'line-through text-slate-400' : 'text-slate-800'}`}>
            {task.title}
          </p>
          {task.description && (
            <p className="text-xs text-slate-500 truncate mb-2">{task.description}</p>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-1.5 py-0.5 rounded border ${PRIORITY_STYLES[task.priority]}`}>
              {task.priority}
            </span>
            {task.dueDate && (
              <span className="text-xs text-slate-500">Due: {task.dueDate}</span>
            )}
          </div>
          {/* Quick move buttons */}
          <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {COLUMNS.filter(c => c.id !== task.status).map(col => (
              <button
                key={col.id}
                onClick={() => onMove(col.id)}
                className={`text-[10px] px-2 py-0.5 rounded ${col.bg} ${col.color} border border-slate-200 hover:opacity-80`}
              >
                → {col.label}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={onDelete}
          className="flex-shrink-0 p-1 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export function TasksView() {
  const { tasks, addTask, updateTask, deleteTask } = useApp();
  const { showToast } = useToast();

  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [aiBreakdown, setAiBreakdown] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const [newTask, setNewTask] = useState<{
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    dueDate: string;
    status: KanbanStatus;
  }>({ title: '', description: '', priority: 'medium', dueDate: '', status: 'todo' });

  // Filter tasks by search
  const filtered = useMemo(() =>
    tasks.filter(t =>
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      (t.description || '').toLowerCase().includes(search.toLowerCase())
    ),
    [tasks, search]
  );

  const byStatus = (status: KanbanStatus) => filtered.filter(t => t.status === status);

  const handleAddTask = () => {
    if (!newTask.title.trim()) {
      showToast('Task title is required', 'error');
      return;
    }
    addTask({
      ...newTask,
      completed: newTask.status === 'done',
    });
    showToast('Task added!', 'success');
    setNewTask({ title: '', description: '', priority: 'medium', dueDate: '', status: 'todo' });
    setShowAddModal(false);
  };

  const handleToggle = (task: AmaTask) => {
    const completed = !task.completed;
    updateTask(task.id, {
      completed,
      status: completed ? 'done' : 'todo',
    });
    showToast(completed ? 'Task marked complete ✓' : 'Task reopened', 'success');
  };

  const handleDelete = (task: AmaTask) => {
    deleteTask(task.id);
    showToast('Task deleted', 'info');
  };

  const handleMove = (task: AmaTask, status: KanbanStatus) => {
    updateTask(task.id, { status, completed: status === 'done' });
    showToast(`Moved to ${status}`, 'info');
  };

  // AI Breakdown: send a task list to Claude and get structured subtasks
  const handleAmaBreakdown = async () => {
    const activeTasks = tasks.filter(t => !t.completed);
    if (activeTasks.length === 0) {
      showToast('No active tasks to break down', 'info');
      return;
    }
    setAiLoading(true);
    setAiBreakdown(null);
    showToast('Ryve is breaking down your tasks…', 'loading');
    try {
      const list = activeTasks.slice(0, 6).map(t =>
        `- [${t.priority}] ${t.title}${t.dueDate ? ` (due: ${t.dueDate})` : ''}`
      ).join('\n');
      const result = await askClaude(
        `Break down these tasks into actionable subtasks (2-4 per task):\n${list}\n\nFor each task list 2-4 specific subtasks with checkboxes. Be concise and practical.`,
        'You are Ryve, an executive AI Chief of Staff. Respond with clean Markdown using - [ ] checkboxes.'
      );
      setAiBreakdown(result);
      showToast('Breakdown ready!', 'success');
    } catch {
      showToast('Could not reach backend', 'error');
    } finally {
      setAiLoading(false);
    }
  };

  // AI Prioritize: analyze actual task list
  const handleAmaPrioritize = async () => {
    if (tasks.length === 0) {
      showToast('No tasks to prioritize', 'info');
      return;
    }
    setAiLoading(true);
    setAiBreakdown(null);
    showToast('Ryve is analyzing priorities…', 'loading');
    try {
      const list = tasks.slice(0, 10).map(t =>
        `- [${t.priority}|${t.status}] ${t.title}${t.dueDate ? ` (due: ${t.dueDate})` : ''}`
      ).join('\n');
      const result = await askClaude(
        `Analyze these tasks and provide a prioritized top-5 action list with brief reasoning:\n${list}`,
        'You are Ryve, an executive AI Chief of Staff. Be direct and tactical. Use numbered list.'
      );
      setAiBreakdown(result);
      showToast('Prioritization complete!', 'success');
    } catch {
      showToast('Could not reach backend', 'error');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-6 h-full overflow-auto bg-slate-50">
      {/* Add Task Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">New Task</h3>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
                <input
                  id="new-task-title"
                  type="text"
                  value={newTask.title}
                  onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                  placeholder="Task title…"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  value={newTask.description}
                  onChange={e => setNewTask({ ...newTask, description: e.target.value })}
                  rows={2}
                  placeholder="Optional details…"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
                  <select
                    value={newTask.priority}
                    onChange={e => setNewTask({ ...newTask, priority: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={newTask.dueDate}
                    onChange={e => setNewTask({ ...newTask, dueDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Start In</label>
                <select
                  value={newTask.status}
                  onChange={e => setNewTask({ ...newTask, status: e.target.value as KanbanStatus })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                >
                  <option value="todo">To Do</option>
                  <option value="in-progress">In Progress</option>
                  <option value="done">Done</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  id="add-task-submit-btn"
                  onClick={handleAddTask}
                  className="flex-1 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg hover:from-amber-600 hover:to-orange-700 transition-all font-medium text-sm"
                >
                  Add Task
                </button>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900">Task Tracker</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              id="ama-breakdown-btn"
              onClick={handleAmaBreakdown}
              disabled={aiLoading}
              className="flex items-center gap-1.5 px-3 py-2 bg-purple-100 text-purple-700 hover:bg-purple-200 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
              AI Breakdown
            </button>
            <button
              id="ama-prioritize-btn"
              onClick={handleAmaPrioritize}
              disabled={aiLoading}
              className="flex items-center gap-1.5 px-3 py-2 bg-amber-100 text-amber-700 hover:bg-amber-200 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              AI Prioritize
            </button>
            <button
              id="add-task-btn"
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg hover:from-amber-600 hover:to-orange-700 transition-all shadow-lg shadow-amber-500/30 text-sm"
            >
              <Plus className="w-4 h-4" />
              New Task
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tasks…"
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm shadow-sm"
          />
        </div>

        {/* AI Result Panel */}
        {(aiBreakdown || aiLoading) && (
          <div className="mb-6 bg-white rounded-xl border border-purple-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <span className="font-semibold text-purple-900 text-sm">Ama's Analysis</span>
              </div>
              <button onClick={() => setAiBreakdown(null)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            {aiLoading ? (
              <div className="flex items-center gap-2 text-slate-500 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Analyzing…
              </div>
            ) : (
              <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{aiBreakdown}</div>
            )}
          </div>
        )}

        {/* Kanban Board */}
        {tasks.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-dashed border-slate-300">
            <CheckCircle2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-slate-700 mb-1">No tasks yet</h3>
            <p className="text-sm text-slate-500 mb-4">Create your first task to get started.</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg text-sm font-medium"
            >
              + Add First Task
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {COLUMNS.map(col => {
              const colTasks = byStatus(col.id);
              return (
                <div key={col.id} className={`rounded-xl ${col.bg} border border-slate-200 p-4`}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className={`font-semibold text-sm ${col.color}`}>{col.label}</h3>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-white ${col.color}`}>
                      {colTasks.length}
                    </span>
                  </div>
                  <div className="space-y-2 min-h-[80px]">
                    {colTasks.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-6">No tasks</p>
                    ) : (
                      colTasks.map(task => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onToggle={() => handleToggle(task)}
                          onDelete={() => handleDelete(task)}
                          onMove={(status) => handleMove(task, status)}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
