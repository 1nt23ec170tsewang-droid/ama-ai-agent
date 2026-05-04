import { useState, useRef } from 'react';
import {
  Send, Sparkles, Calendar, Mail, CheckSquare, Bell,
  Paperclip, X, FileText, Image as ImageIcon, Users, MessageSquare, Trash2, Mic, Menu
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useSettings } from '../context/SettingsContext';
import { useEffect } from 'react';
import { API_BASE } from '../utils/config';

const SUGGESTION_CHIPS = [
  { id: '1', icon: Calendar,       label: 'Schedule a meeting',      prompt: 'Help me schedule a team meeting for next week. What should I consider?' },
  { id: '2', icon: Mail,           label: 'Draft an email',           prompt: 'Draft a professional follow-up email for a business meeting.' },
  { id: '3', icon: CheckSquare,    label: 'Create a task plan',       prompt: 'Help me break down a complex project into manageable tasks.' },
  { id: '4', icon: Users,          label: 'Team 1:1 agenda',          prompt: 'Help me create an agenda for 1:1 meetings with my direct reports.' },
  { id: '5', icon: MessageSquare,  label: 'Write a status update',    prompt: 'Help me write a concise weekly status update for my team.' },
  { id: '6', icon: Bell,           label: 'Prioritize my day',        prompt: 'Based on my current workload, how should I prioritize my tasks today?' },
];
export function ChatView() {
  const { tasks, events, team, addTask, addEvent, addTeamMember } = useApp();
  const { user } = useAuth();
  const { profile, aiSettings } = useSettings();
  const { showToast, removeToast } = useToast();

  const [sessions, setSessions] = useState<{id: string, title: string, messages: any[]}[]>(() => {
    const saved = localStorage.getItem('ama_chat_sessions');
    if (saved) return JSON.parse(saved);
    const old = localStorage.getItem('ama_chat_history');
    if (old) {
      const parsed = JSON.parse(old);
      if (parsed.length > 0) {
        return [{ id: Date.now().toString(), title: parsed.find((m: any) => m.role === 'user')?.content || 'Previous Chat', messages: parsed }];
      }
    }
    return [];
  });
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    const saved = localStorage.getItem('ama_chat_sessions');
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed.length > 0 ? parsed[0].id : null;
    }
    const old = localStorage.getItem('ama_chat_history');
    if (old && JSON.parse(old).length > 0) return Date.now().toString();
    return null;
  });

  const activeSession = sessions.find(s => s.id === activeSessionId);
  const messages = activeSession ? activeSession.messages : [];

  const [input, setInput] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateSessionMessages = (sessionId: string, newHistory: any[], sessionTitle: string) => {
    const storable = newHistory.map(m => ({
      ...m,
      files: m.files?.map((f: any) => ({ name: f.name || 'Attachment', type: f.type || '' }))
    }));
    
    setSessions(prev => {
      let exists = prev.some(s => s.id === sessionId);
      let updated;
      if (exists) {
        updated = prev.map(s => s.id === sessionId ? { ...s, messages: storable } : s);
      } else {
        updated = [{ id: sessionId, title: sessionTitle, messages: storable }, ...prev];
      }
      localStorage.setItem('ama_chat_sessions', JSON.stringify(updated));
      window.dispatchEvent(new Event('ama_chat_sessions_updated'));
      return updated;
    });
  };

  const displayName = profile?.name || user?.name || '';
  const firstName = displayName.split(' ')[0] || 'there';

  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    const updateGreeting = () => {
      const h = new Date().getHours();
      let phrases: string[] = [];
      if (h < 12) {
        phrases = [`Good morning, ${firstName}.`, `Morning, ${firstName}.`, `Ready to start?`, `Greetings, ${firstName}.`];
      } else if (h < 17) {
        phrases = [`Good afternoon, ${firstName}.`, `Afternoon, ${firstName}.`, `Hope you're well.`, `Greetings, ${firstName}.`];
      } else {
        phrases = [`Good evening, ${firstName}.`, `Good night, ${firstName}.`, `Evening, ${firstName}.`, `Hello, ${firstName}.`];
      }
      setGreeting(phrases[Math.floor(Math.random() * phrases.length)]);
    };
    updateGreeting();
    const interval = setInterval(updateGreeting, 60000);
    return () => clearInterval(interval);
  }, [firstName]);

  // Build live system prompt from real data
  const buildSystemPrompt = () => {
    const now = new Date().toLocaleString();
    const pendingTasks = tasks.filter(t => !t.completed);
    const highPriority = pendingTasks.filter(t => t.priority === 'high');
    const todayISO = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
    const todayEvents = events.filter(e => (e.date || todayISO) === todayISO);

    const stylePrompt = aiSettings?.communicationStyle === 'Professional' 
      ? 'You are professional, formal, and highly structured.' 
      : aiSettings?.communicationStyle === 'Casual'
      ? 'You are casual, friendly, and use a conversational tone with occasional emojis.'
      : 'You are concise, direct, and use minimal words. Get straight to the point.';
      
    const proactivePrompt = aiSettings?.proactiveSuggestions
      ? 'You should proactively suggest next steps, anticipate the user\'s needs, and offer helpful tips unprompted.'
      : 'Wait for explicit instructions before suggesting new tasks or ideas.';
      
    const autoSchedulePrompt = aiSettings?.autoScheduleTasks
      ? 'If the user mentions an action item, automatically propose a specific time or deadline for it in your response.'
      : 'Do not schedule tasks or deadlines unless the user explicitly asks for them.';

    return `You are Ama, an expert AI Chief of Staff. ${stylePrompt}
${proactivePrompt}
${autoSchedulePrompt}

LIVE CONTEXT (${now}):
- User: ${user?.name || 'Executive'} (${user?.email || ''})
- Pending tasks: ${pendingTasks.length} total, ${highPriority.length} high priority
- Events today: ${todayEvents.length}
- Team members: ${team.length}

IMPORTANT: If the user asks you to create a task, you MUST include this EXACT JSON block anywhere in your response:
\`\`\`json
{
  "action": "CREATE_TASK",
  "task": {
    "title": "Task title",
    "description": "Short description",
    "priority": "high" | "medium" | "low",
    "dueDate": "YYYY-MM-DD"
  }
}
\`\`\`

If the user asks you to schedule an event/meeting, you MUST include this EXACT JSON block:
\`\`\`json
{
  "action": "CREATE_EVENT",
  "event": {
    "title": "Meeting title",
    "time": "10:00 AM",
    "duration": "1h",
    "type": "meeting",
    "location": "Online / Room",
    "attendees": 2,
    "date": "YYYY-MM-DD"
  }
}
\`\`\`

If the user asks you to add or invite a team member, you MUST include this EXACT JSON block:
\`\`\`json
{
  "action": "CREATE_TEAM_MEMBER",
  "member": {
    "name": "Full Name",
    "role": "Job Title",
    "department": "Department",
    "email": "email@example.com"
  }
}
\`\`\`

In addition to your Chief of Staff duties, you MUST be able to answer ANY out-of-the-box or general knowledge questions the user asks. Provide fast, highly accurate, and direct answers to any non-work related questions to ensure a seamless conversational experience. Keep standard responses under 200 words unless asked for more details.`;
  };

  const sendMessage = async (userText: string, files?: File[]) => {
    if (!userText.trim() && (!files || files.length === 0)) return;

    const userMsg = { role: 'user', content: userText, files: files || [] };
    const history = [...messages, userMsg];
    
    let currentId = activeSessionId;
    if (!currentId) {
      currentId = Date.now().toString();
      setActiveSessionId(currentId);
    }
    
    updateSessionMessages(currentId, history, userText || 'New Chat with files');
    setInput('');
    setSelectedFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = '';

    setIsLoading(true);
    const toastId = showToast('Ama is thinking…', 'loading');

    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${API_BASE}/api/ama/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          messages: history.map(m => ({ role: m.role, content: m.content })),
          systemPrompt: buildSystemPrompt(),
          userContext: {
            name: user?.name,
            email: user?.email,
            tasksCount: tasks.filter(t => !t.completed).length,
            eventsCount: events.length,
          },
        }),
      });

      const data = await res.json();
      if (res.ok && data.response) {
        let content = data.response;
        
        // Parse JSON blocks for actions (more robust regex)
        const jsonBlockRegex = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/gi;
        let match;
        let hasAction = false;
        while ((match = jsonBlockRegex.exec(content)) !== null) {
          try {
            const parsed = JSON.parse(match[1]);
            if (parsed.action === 'CREATE_TASK' && parsed.task) {
              const dueDate = parsed.task.dueDate || new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
              addTask({ ...parsed.task, dueDate, status: 'todo', completed: false });
              showToast(`Task created: ${parsed.task.title}`, 'success');
              hasAction = true;
            } else if (parsed.action === 'CREATE_EVENT' && parsed.event) {
              const date = parsed.event.date || new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
              addEvent({ ...parsed.event, date });
              showToast(`Event scheduled: ${parsed.event.title}`, 'success');
              hasAction = true;
            } else if (parsed.action === 'CREATE_TEAM_MEMBER' && parsed.member) {
              addTeamMember({
                ...parsed.member,
                status: 'online',
                workload: 'medium',
                taskCompletion: 0,
                currentKPI: 'Onboarding',
                tasksCompleted: 0,
                tasksTotal: 0,
                metrics: { productivity: 100, responseTime: '1h', projectsActive: 1 }
              });
              showToast(`Team member added: ${parsed.member.name}`, 'success');
              hasAction = true;
            }
          } catch (e) {
            console.error('Failed to parse AI action JSON:', e);
          }
        }
        
        // Remove the JSON block from the displayed message
        content = content.replace(/```(?:json)?\s*\{[\s\S]*?\}\s*```/gi, '').trim();
        if (!content && hasAction) content = "Done!";
        if (!content && !hasAction) content = "I processed your request.";

        const newHistory = [...history, { role: 'assistant', content }];
        updateSessionMessages(currentId as string, newHistory, userText || 'New Chat with files');
      } else {
        const errMsg = data.error || data.message || 'AI response failed.';
        console.error('Chat backend error:', errMsg);
        showToast(`AI error: ${errMsg.slice(0, 80)}`, 'error');
        updateSessionMessages(currentId as string, [...history, {
          role: 'assistant',
          content: `⚠️ ${errMsg}\n\nCheck that your GEMINI_API_KEY is valid in the backend .env file.`,
        }], userText || 'New Chat');
      }
    } catch (err: any) {
      const msg = err?.message || 'Network error';
      const errorHistory = [...history, {
        role: 'assistant',
        content: '⚠️ Could not reach the backend. Make sure it is running.',
      }];
      updateSessionMessages(currentId as string, errorHistory, userText || 'New Chat');
      showToast(`Connection failed: ${msg}`, 'error');
    } finally {
      removeToast(toastId);
      setIsLoading(false);
    }
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSessions(prev => {
      const updated = prev.filter(s => s.id !== id);
      localStorage.setItem('ama_chat_sessions', JSON.stringify(updated));
      window.dispatchEvent(new Event('ama_chat_sessions_updated'));
      return updated;
    });
    if (activeSessionId === id) {
      setActiveSessionId(null);
    }
    showToast('Chat history deleted', 'info');
  };

  const clearAllSessions = () => {
    if (!window.confirm('Are you sure you want to delete all chat history?')) return;
    setSessions([]);
    setActiveSessionId(null);
    localStorage.removeItem('ama_chat_sessions');
    window.dispatchEvent(new Event('ama_chat_sessions_updated'));
    showToast('All chat history cleared', 'info');
  };

  useEffect(() => {
    const handleSelect = (e: any) => {
      setActiveSessionId(e.detail);
    };
    window.addEventListener('select_chat_session', handleSelect);
    return () => window.removeEventListener('select_chat_session', handleSelect);
  }, []);

  const handleSend = () => sendMessage(input, selectedFiles);

  const handleChipClick = (chip: typeof SUGGESTION_CHIPS[0]) => {
    sendMessage(chip.prompt);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  return (
    <div className="flex h-full bg-white relative overflow-hidden">

      {/* ── Mobile overlay backdrop ────────────────────────────────────── */}
      {historyOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setHistoryOpen(false)}
        />
      )}

      {/* ── History Sidebar (desktop: always visible | mobile: drawer) ── */}
      <div className={`
        flex-col bg-slate-50 border-r border-slate-200
        md:flex md:relative md:translate-x-0 md:w-64
        fixed inset-y-0 left-0 z-50 w-72
        transition-transform duration-300 ease-in-out
        ${historyOpen ? 'flex translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Chat History
          </h3>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => { setActiveSessionId(null); setHistoryOpen(false); }}
              className="text-xs px-2 py-1 bg-orange-100 text-orange-600 hover:bg-orange-200 rounded-md font-medium transition-colors"
              title="Start a new chat"
            >
              + New
            </button>
            {/* Close button — mobile only */}
            <button
              onClick={() => setHistoryOpen(false)}
              className="md:hidden p-1 hover:bg-slate-200 rounded-lg transition-colors text-slate-500"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessions.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">No recent history</p>
          ) : (
            <>
              {sessions.map((session) => (
                <div 
                  key={session.id} 
                  onClick={() => { setActiveSessionId(session.id); setHistoryOpen(false); }}
                  className={`group flex items-center justify-between px-3 py-2 text-sm rounded-lg cursor-pointer transition-colors ${
                    activeSessionId === session.id 
                      ? 'bg-orange-100 text-orange-800' 
                      : 'text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span className="truncate pr-2">{session.title || 'Chat'}</span>
                  <button
                    onClick={(e) => deleteSession(e, session.id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-100 hover:text-red-600 rounded text-slate-400 transition-all focus:opacity-100"
                    title="Delete Chat"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <div className="pt-4 pb-2 px-2 border-t border-slate-200 mt-4">
                <button
                  onClick={clearAllSessions}
                  className="w-full py-2 text-xs text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center gap-1.5 font-medium"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear All History
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Main Chat Area ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col h-full relative min-w-0">
        {/* Mobile top bar — history toggle */}
        <div className="md:hidden flex items-center gap-2 px-3 py-2 border-b border-slate-100 bg-white flex-shrink-0">
          <button
            onClick={() => setHistoryOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 text-sm font-medium transition-colors"
          >
            <Menu className="w-4 h-4" />
            History
          </button>
          <button
            onClick={() => { setActiveSessionId(null); }}
            className="ml-auto text-xs px-3 py-1.5 bg-orange-100 text-orange-600 hover:bg-orange-200 rounded-lg font-medium transition-colors"
          >
            + New Chat
          </button>
        </div>
        {messages.length === 0 ? (
        <>
          {/* Welcome Screen */}
          <div className="flex-1 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-3xl mx-auto space-y-6">
              
              <div className="text-center mb-2">
                <h2 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center justify-center gap-3">
                  <Sparkles className="w-5 h-5 md:w-6 md:h-6 text-orange-500" />
                  {greeting}
                </h2>
                <p className="text-slate-500 mt-2 text-sm md:text-base">How can I assist you right now?</p>
              </div>

              {/* Center Input */}
              <div>
                <InputBar
                  input={input}
                  setInput={setInput}
                  selectedFiles={selectedFiles}
                  onRemoveFile={i => setSelectedFiles(prev => prev.filter((_, idx) => idx !== i))}
                  fileInputRef={fileInputRef}
                  onFileSelect={handleFileSelect}
                  onSend={handleSend}
                  isLoading={isLoading}
                />
              </div>

              {/* Suggestion Chips Below Input */}
              <div className="flex flex-wrap justify-center gap-2 md:gap-3 px-4">
                {SUGGESTION_CHIPS.map(chip => {
                  const Icon = chip.icon;
                  return (
                    <button
                      key={chip.id}
                      id={`chip-${chip.id}`}
                      onClick={() => handleChipClick(chip)}
                      className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-white hover:bg-slate-50 border border-slate-200 hover:border-orange-300 rounded-full text-slate-600 hover:text-slate-900 text-xs md:text-sm transition-all shadow-sm"
                    >
                      <Icon className="w-4 h-4 text-slate-400 group-hover:text-orange-500" />
                      {chip.label}
                    </button>
                  );
                })}
              </div>

            </div>
          </div>
        </>
      ) : (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="max-w-3xl mx-auto space-y-4 md:space-y-5">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-2xl rounded-2xl px-5 py-3.5 text-sm ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-200/50'
                        : 'bg-slate-50 border border-slate-200 text-slate-800'
                    }`}
                  >
                    {msg.content && <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>}
                    {msg.files && msg.files.length > 0 && (
                      <div className="space-y-1 mt-2">
                        {msg.files.map((f: any, fi: number) => (
                          <div key={fi} className={`flex items-center gap-2 p-1.5 rounded ${msg.role === 'user' ? 'bg-white/20' : 'bg-white'}`}>
                            {f.type?.startsWith('image/') ? <ImageIcon className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                            <span className="text-xs truncate">{f.name || 'Attachment'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-slate-500 text-sm flex items-center gap-2">
                    <span className="inline-flex gap-1">
                      {[0, 150, 300].map(d => (
                        <span key={d} className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                      ))}
                    </span>
                    Ama is thinking…
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Input */}
          <div className="p-4 md:p-6 bg-white border-t border-slate-100" style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}>
            <div className="max-w-3xl mx-auto">
              <InputBar
                input={input}
                setInput={setInput}
                selectedFiles={selectedFiles}
                onRemoveFile={i => setSelectedFiles(prev => prev.filter((_, idx) => idx !== i))}
                fileInputRef={fileInputRef}
                onFileSelect={handleFileSelect}
                onSend={handleSend}
                isLoading={isLoading}
              />
            </div>
          </div>
        </>
        )}
      </div>
    </div>
  );
}

// ── Shared InputBar ────────────────────────────────────────────────────────────
function InputBar({
  input, setInput, selectedFiles, onRemoveFile,
  fileInputRef, onFileSelect, onSend, isLoading,
}: {
  input: string;
  setInput: (v: string) => void;
  selectedFiles: File[];
  onRemoveFile: (i: number) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSend: () => void;
  isLoading: boolean;
}) {
  const [isListening, setIsListening] = useState(false);

  const handleVoice = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Your browser does not support Voice Recognition.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(input + (input ? ' ' : '') + transcript);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognition.start();
  };

  return (
    <>
      {selectedFiles.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {selectedFiles.map((f, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-sm">
              {f.type.startsWith('image/') ? <ImageIcon className="w-4 h-4 text-orange-500" /> : <FileText className="w-4 h-4 text-orange-500" />}
              <span className="text-slate-700 truncate max-w-[130px] text-xs">{f.name}</span>
              <button onClick={() => onRemoveFile(i)} className="text-slate-400 hover:text-red-500">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2 bg-white border border-slate-200 rounded-2xl p-2 shadow-lg shadow-slate-200/50">
        <input type="file" ref={fileInputRef} onChange={onFileSelect} multiple className="hidden" />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-2.5 text-orange-500 hover:bg-orange-50 rounded-xl transition-all"
        >
          <Paperclip className="w-5 h-5" />
        </button>
        <input
          id="chat-input"
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && onSend()}
          placeholder="Ask Ama anything…"
          disabled={isLoading}
          className="flex-1 px-2 py-2.5 bg-transparent focus:outline-none text-sm text-slate-900 placeholder:text-slate-400 disabled:opacity-50"
        />
        <button
          onClick={handleVoice}
          className={`p-2.5 rounded-xl transition-all ${
            isListening ? 'bg-red-100 text-red-500 animate-pulse' : 'text-slate-400 hover:text-orange-500 hover:bg-orange-50'
          }`}
          title="Voice Command"
        >
          <Mic className="w-5 h-5" />
        </button>
        <button
          id="chat-send-btn"
          onClick={onSend}
          disabled={(!input.trim() && selectedFiles.length === 0) || isLoading}
          className="p-2.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl hover:from-orange-600 hover:to-orange-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </>
  );
}
