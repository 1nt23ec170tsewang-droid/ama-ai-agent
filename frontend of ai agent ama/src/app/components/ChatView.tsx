import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  Send, Sparkles, Calendar, Mail, CheckSquare, Bell,
  Paperclip, X, FileText, Image as ImageIcon, Users,
  MessageSquare, Trash2, Mic, Menu, Square, Copy,
  Check, RefreshCw, Plus, ChevronDown, ExternalLink, ShieldCheck,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { API_BASE } from '../utils/config';

// ── Google Fonts injection ────────────────────────────────────────────────────
if (!document.getElementById('ama-inter-font')) {
  const link = document.createElement('link');
  link.id = 'ama-inter-font';
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap';
  document.head.appendChild(link);
}

// ── Suggestion chips ──────────────────────────────────────────────────────────
const SUGGESTION_CHIPS = [
  { id: '1', icon: Calendar,      label: 'Schedule a meeting',   prompt: 'I need to schedule a meeting.' },
  { id: '2', icon: Mail,          label: 'Draft an email',        prompt: 'I need to draft an email.' },
  { id: '3', icon: CheckSquare,   label: 'Create a task plan',    prompt: 'Help me break down a complex project into manageable tasks.' },
  { id: '4', icon: Users,         label: 'Team 1:1 agenda',       prompt: 'Help me create an agenda for 1:1 meetings with my direct reports.' },
  { id: '5', icon: MessageSquare, label: 'Write a status update', prompt: 'Help me write a concise weekly status update for my team.' },
  { id: '6', icon: Bell,          label: 'Prioritize my day',     prompt: 'Based on my current workload, how should I prioritize my tasks today?' },
];

// ── Copy-code button ──────────────────────────────────────────────────────────
function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={handleCopy}
      className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all"
      style={{ background: 'rgba(255,255,255,0.08)', color: copied ? '#4ade80' : '#94a3b8' }}
      title="Copy code"
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

// ── Markdown renderer ─────────────────────────────────────────────────────────
function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ node, className, children, ...props }: any) {
          const match = /language-(\w+)/.exec(className || '');
          const codeStr = String(children).replace(/\n$/, '');
          const isBlock = match || codeStr.includes('\n');
          if (isBlock) {
            return (
              <div className="relative my-3 rounded-xl overflow-hidden" style={{ background: '#0d1117' }}>
                <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  <span className="text-xs font-medium" style={{ color: '#64748b' }}>
                    {match?.[1] || 'code'}
                  </span>
                  <CopyButton code={codeStr} />
                </div>
                <SyntaxHighlighter
                  style={oneDark}
                  language={match?.[1] || 'text'}
                  PreTag="div"
                  customStyle={{ margin: 0, padding: '1rem', background: 'transparent', fontSize: '0.82rem', lineHeight: '1.6' }}
                  {...props}
                >
                  {codeStr}
                </SyntaxHighlighter>
              </div>
            );
          }
          return (
            <code
              className="px-1.5 py-0.5 rounded text-xs font-mono"
              style={{ background: 'rgba(99,102,241,0.15)', color: '#a78bfa' }}
              {...props}
            >
              {children}
            </code>
          );
        },
        table({ children }) {
          return (
            <div className="overflow-x-auto my-3">
              <table className="w-full text-sm border-collapse" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                {children}
              </table>
            </div>
          );
        },
        th({ children }) {
          return <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider" style={{ background: 'rgba(255,255,255,0.05)', color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>{children}</th>;
        },
        td({ children }) {
          return <td className="px-4 py-2 text-sm" style={{ color: '#cbd5e1', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>{children}</td>;
        },
        p({ children }) {
          return <p className="mb-3 last:mb-0 leading-relaxed" style={{ color: '#cbd5e1' }}>{children}</p>;
        },
        ul({ children }) {
          return <ul className="mb-3 space-y-1 pl-5 list-disc" style={{ color: '#cbd5e1' }}>{children}</ul>;
        },
        ol({ children }) {
          return <ol className="mb-3 space-y-1 pl-5 list-decimal" style={{ color: '#cbd5e1' }}>{children}</ol>;
        },
        li({ children }) {
          return <li className="leading-relaxed" style={{ color: '#cbd5e1' }}>{children}</li>;
        },
        strong({ children }) {
          return <strong style={{ color: '#f1f5f9', fontWeight: 600 }}>{children}</strong>;
        },
        h1({ children }) { return <h1 className="text-xl font-bold mb-3 mt-2" style={{ color: '#f1f5f9' }}>{children}</h1>; },
        h2({ children }) { return <h2 className="text-lg font-semibold mb-2 mt-4" style={{ color: '#f1f5f9' }}>{children}</h2>; },
        h3({ children }) { return <h3 className="text-base font-semibold mb-2 mt-3" style={{ color: '#e2e8f0' }}>{children}</h3>; },
        blockquote({ children }) {
          return (
            <blockquote className="border-l-2 pl-4 my-3 italic" style={{ borderColor: '#6366f1', color: '#94a3b8' }}>
              {children}
            </blockquote>
          );
        },
        hr() {
          return <hr className="my-4" style={{ borderColor: 'rgba(255,255,255,0.08)' }} />;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

// ── Typing indicator ──────────────────────────────────────────────────────────
// ── Per-message copy button (proper React state) ──────────────────────────────
function MsgCopyButton({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div className="mt-2 flex justify-end">
      <button
        onClick={handleCopy}
        className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-all opacity-0 group-hover:opacity-100"
        style={{
          color: copied ? '#4ade80' : '#94a3b8',
          background: copied ? 'rgba(74,222,128,0.08)' : 'rgba(255,255,255,0.05)',
        }}
        title="Copy response"
      >
        {copied
          ? <><Check className="w-3 h-3" /> Copied!</>
          : <><Copy className="w-3 h-3" /> Copy</>
        }
      </button>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-1 py-2">
      {[0, 1, 2].map(i => (
        <motion.span
          key={i}
          className="w-2 h-2 rounded-full"
          style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)' }}
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.1, 0.8] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }}
        />
      ))}
      <span className="text-xs ml-1" style={{ color: '#64748b' }}>Ama is thinking…</span>
    </div>
  );
}

// ── Main ChatView ─────────────────────────────────────────────────────────────
export function ChatView({ sidebarOpen, onCloseSidebar }: { sidebarOpen?: boolean; onCloseSidebar?: () => void }) {
  const { tasks, events, team, addTask, addEvent, addTeamMember } = useApp();
  const { user } = useAuth();
  const { profile, aiSettings, privacy } = useSettings();

  // ── Session state ────────────────────────────────────────────────────────
  const [sessions, setSessions] = useState<{ id: string; title: string; messages: any[] }[]>(() => {
    if (privacy?.incognitoMode) return [];
    try {
      const saved = localStorage.getItem('ama_chat_sessions');
      if (saved) return JSON.parse(saved);
      const old = localStorage.getItem('ama_chat_history');
      if (old) {
        const parsed = JSON.parse(old);
        if (parsed.length > 0) return [{ id: Date.now().toString(), title: parsed.find((m: any) => m.role === 'user')?.content || 'Previous Chat', messages: parsed }];
      }
    } catch (_) {}
    return [];
  });
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem('ama_chat_sessions');
      if (saved) { const p = JSON.parse(saved); return p.length > 0 ? p[0].id : null; }
    } catch (_) {}
    return null;
  });

  const activeSession = sessions.find(s => s.id === activeSessionId);
  const messages: any[] = activeSession ? activeSession.messages : [];

  // ── UI state ─────────────────────────────────────────────────────────────
  const [input, setInput] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [userScrolled, setUserScrolled] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // ── Greeting ─────────────────────────────────────────────────────────────
  const displayName = profile?.name || user?.name || '';
  const firstName = displayName.split(' ')[0] || 'there';
  const [greeting, setGreeting] = useState('');
  useEffect(() => {
    const update = () => {
      const h = new Date().getHours();
      const sets: Record<string, string[]> = {
        morning: [`Good morning, ${firstName}.`, `Morning, ${firstName}.`, `Ready to conquer the day?`],
        afternoon: [`Good afternoon, ${firstName}.`, `Afternoon, ${firstName}.`, `Hope you're crushing it.`],
        evening: [`Good evening, ${firstName}.`, `Evening, ${firstName}.`, `Let's wrap the day strong.`],
      };
      const key = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
      const arr = sets[key];
      setGreeting(arr[Math.floor(Math.random() * arr.length)]);
    };
    update();
    const t = setInterval(update, 60000);
    return () => clearInterval(t);
  }, [firstName]);

  // ── Gmail state ──────────────────────────────────────────────────────────
  const [gmailEmail] = useState<string | null>(() => localStorage.getItem('ama_gmail_email'));
  const [pendingEmail, setPendingEmail] = useState<{ to: string; subject: string; body: string } | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSentMsg, setEmailSentMsg] = useState('');

  // ── Auto-resize textarea ─────────────────────────────────────────────────
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 140)}px`;
  }, [input]);

  // ── Smart auto-scroll ────────────────────────────────────────────────────
  const scrollToBottom = useCallback((force = false) => {
    if (force || !userScrolled) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [userScrolled]);

  useEffect(() => { scrollToBottom(); }, [messages, streamingContent]);

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setUserScrolled(!atBottom);
    setShowScrollBtn(!atBottom && (isLoading || !!streamingContent));
  };

  // ── Session helpers ──────────────────────────────────────────────────────
  const updateSessionMessages = (sessionId: string, newHistory: any[], sessionTitle: string) => {
    const storable = newHistory.map(m => ({
      ...m,
      files: m.files?.map((f: any) => ({ name: f.name || 'Attachment', type: f.type || '' }))
    }));
    setSessions(prev => {
      if (privacy?.incognitoMode) return prev;
      const exists = prev.some(s => s.id === sessionId);
      const updated = exists
        ? prev.map(s => s.id === sessionId ? { ...s, messages: storable } : s)
        : [{ id: sessionId, title: sessionTitle, messages: storable }, ...prev];
      localStorage.setItem('ama_chat_sessions', JSON.stringify(updated));
      window.dispatchEvent(new Event('ama_chat_sessions_updated'));
      return updated;
    });
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSessions(prev => {
      const updated = prev.filter(s => s.id !== id);
      localStorage.setItem('ama_chat_sessions', JSON.stringify(updated));
      window.dispatchEvent(new Event('ama_chat_sessions_updated'));
      return updated;
    });
    if (activeSessionId === id) setActiveSessionId(null);
  };

  const clearAllSessions = () => {
    if (!window.confirm('Delete all chat history?')) return;
    setSessions([]);
    setActiveSessionId(null);
    localStorage.removeItem('ama_chat_sessions');
    window.dispatchEvent(new Event('ama_chat_sessions_updated'));
  };

  // ── System prompt ────────────────────────────────────────────────────────
  const buildSystemPrompt = () => {
    const now = new Date().toLocaleString();
    const pendingTasks = tasks.filter(t => !t.completed);
    const highPriority = pendingTasks.filter(t => t.priority === 'high');
    const todayISO = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
    const todayEvents = events.filter(e => (e.date || todayISO) === todayISO);

    const stylePrompt = aiSettings?.communicationStyle === 'Professional'
      ? 'You are professional, formal, and highly structured in your responses.'
      : aiSettings?.communicationStyle === 'Casual'
      ? 'You are casual, warm, friendly, and conversational.'
      : 'You are balanced, warm, direct, and naturally conversational.';

    return `You are Ama, a sophisticated and helpful AI Chief of Staff. ${stylePrompt}
You use structured Markdown (bold, lists, code blocks, tables) to make responses clear and scannable.

❌ BANNED PHRASES — NEVER say any of these:
- "I processed your request"
- "I have noted your request"
- "I will take care of that"
- "Understood, I will proceed"
- Any similarly hollow, non-answer acknowledgment.

✅ ALWAYS respond with real content:
- Questions → answer them fully and directly.
- Creative tasks (joke, poem, story, email draft) → write the content immediately.
- Action requests → write a friendly 1-sentence confirmation FIRST, then the JSON block below.
- Explanations → explain clearly with examples.

LIVE CONTEXT (${now}):
- User: ${user?.name || 'Executive'} (${user?.email || ''})
- Pending tasks: ${pendingTasks.length} total, ${highPriority.length} high priority
- Events today: ${todayEvents.length}
- Team members: ${team.length}

ACTION BLOCKS — Only include when the user EXPLICITLY requests an action. Regular questions and conversation must NEVER produce JSON.

To create a task — friendly reply first, then:
\`\`\`json
{ "action": "CREATE_TASK", "task": { "title": "Task title", "description": "Short description", "priority": "high|medium|low", "dueDate": "YYYY-MM-DD" } }
\`\`\`

To create a meeting/event — friendly reply first, then:
\`\`\`json
{ "action": "CREATE_EVENT", "event": { "title": "Meeting title", "time": "10:00 AM", "duration": "1h", "type": "meeting", "location": "Online", "attendees": 2, "date": "YYYY-MM-DD" } }
\`\`\`

To add a team member — friendly reply first, then:
\`\`\`json
{ "action": "CREATE_TEAM_MEMBER", "member": { "name": "Full Name", "role": "Job Title", "department": "Department", "email": "email@example.com" } }
\`\`\`

Always provide exact values. Never use placeholder ranges.`;
  };

  // ── Action parser ────────────────────────────────────────────────────────
  const parseAndExecuteActions = (content: string) => {
    // Only match JSON blocks that contain a known "action" key — avoids stripping regular code examples
    const actionBlockRegex = /```(?:json)?\s*(\{[\s\S]*?"action"\s*:[\s\S]*?\})\s*```/gi;
    let match;
    let hasAction = false;
    let hasSendEmail = false;

    const regex = /```(?:json)?\s*(\{[\s\S]*?"action"\s*:[\s\S]*?\})\s*```/gi;
    while ((match = regex.exec(content)) !== null) {
      try {
        const parsed = JSON.parse(match[1]);
        if (parsed.action === 'CREATE_TASK' && parsed.task) {
          const dueDate = parsed.task.dueDate || new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
          addTask({ ...parsed.task, dueDate, status: 'todo', completed: false });
          hasAction = true;
        } else if (parsed.action === 'CREATE_EVENT' && parsed.event) {
          const date = parsed.event.date || new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
          addEvent({ ...parsed.event, date });
          hasAction = true;
        } else if (parsed.action === 'CREATE_TEAM_MEMBER' && parsed.member) {
          addTeamMember({ ...parsed.member, status: 'online', workload: 'medium', taskCompletion: 0, currentKPI: 'Onboarding', tasksCompleted: 0, tasksTotal: 0, metrics: { productivity: 100, responseTime: '1h', projectsActive: 1 } });
          hasAction = true;
        } else if (parsed.action === 'SEND_EMAIL' && parsed.email) {
          setPendingEmail({ to: parsed.email.to, subject: parsed.email.subject, body: parsed.email.body });
          hasSendEmail = true;
          hasAction = true;
        }
      } catch (_) {}
    }

    // Strip ONLY action blocks from the visible text; leave regular code blocks intact
    let clean = content.replace(/```(?:json)?\s*\{[\s\S]*?"action"\s*:[\s\S]*?\}\s*```/gi, '').trim();

    // Append action confirmations BELOW the conversational text
    if (hasSendEmail) clean = (clean ? clean + '\n\n' : '') + '\ud83d\udce7 **Email ready.** Review and confirm the draft below.';
    else if (hasAction && !clean) clean = '\u2705 Done! I\'ve taken care of that for you.';

    // CRITICAL FIX: Never replace real AI text with a generic placeholder
    // Return the content as-is if there is any real text
    return clean || content.trim() || '';
  };

  // ── Stop generation ──────────────────────────────────────────────────────
  const stopGeneration = () => {
    abortRef.current?.abort();
  };

  // ── Send message (SSE streaming) ─────────────────────────────────────────
  const sendMessage = async (userText: string, files?: File[]) => {
    if (!userText.trim() && (!files || files.length === 0)) return;
    if (isLoading) return;

    const userMsg = { role: 'user', content: userText, files: files || [] };
    const history = [...messages, userMsg];

    let currentId = activeSessionId;
    if (!currentId) {
      currentId = Date.now().toString();
      setActiveSessionId(currentId);
    }

    updateSessionMessages(currentId, history, userText || 'New Chat');
    setInput('');
    setSelectedFiles([]);
    setUserScrolled(false);
    if (fileInputRef.current) fileInputRef.current.value = '';

    setIsLoading(true);
    setStreamingContent('');

    const controller = new AbortController();
    abortRef.current = controller;
    let accumulated = ''; // Track across try/catch for abort recovery

    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${API_BASE}/api/ama/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          messages: history.map(m => ({ role: m.role, content: m.content })),
          systemPrompt: buildSystemPrompt(),
          userContext: { name: user?.name, email: user?.email },
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Server error ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === '[DONE]') { streamDone = true; break; }
          try {
            const parsed = JSON.parse(payload);
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.delta) {
              accumulated += parsed.delta;
              setStreamingContent(accumulated);
            }
          } catch (parseErr: any) {
            if (parseErr.message !== 'Unexpected end of JSON input') console.warn('SSE parse warn:', parseErr.message);
          }
        }
      }

      // Stream complete — parse actions, preserve ALL real AI text
      const finalContent = parseAndExecuteActions(accumulated);
      setStreamingContent('');
      updateSessionMessages(currentId as string, [...history, { role: 'assistant', content: finalContent || accumulated || 'No response received.' }], userText || 'New Chat');

    } catch (err: any) {
      setStreamingContent('');
      if (err.name === 'AbortError') {
        // User stopped — save whatever was streamed so far
        const saved = accumulated.trim() || '⏹️ Generation stopped.';
        updateSessionMessages(currentId as string, [...history, { role: 'assistant', content: saved }], userText || 'New Chat');
      } else {
        updateSessionMessages(currentId as string, [...history, {
          role: 'assistant',
          content: `⚠️ ${err.message || 'Could not reach the backend. Make sure it is running.'}`,
        }], userText || 'New Chat');
      }
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  };

  // ── Regenerate last response ─────────────────────────────────────────────
  const regenerate = () => {
    if (!messages.length || isLoading) return;
    // Find the last user message
    const lastUserIdx = [...messages].map((m, i) => m.role === 'user' ? i : -1).filter(i => i >= 0).pop();
    if (lastUserIdx === undefined) return;
    const lastUserMsg = messages[lastUserIdx];
    // Strip history back to the user message
    const trimmed = messages.slice(0, lastUserIdx);
    setPendingEmail(null);
    setEmailSentMsg('');
    if (activeSessionId) updateSessionMessages(activeSessionId, trimmed, lastUserMsg.content);
    setTimeout(() => sendMessage(lastUserMsg.content), 50);
  };

  // ── External events ───────────────────────────────────────────────────────
  useEffect(() => { if (sidebarOpen) setHistoryOpen(false); }, [sidebarOpen]);
  useEffect(() => {
    const handle = (e: any) => setActiveSessionId(e.detail);
    window.addEventListener('select_chat_session', handle);
    return () => window.removeEventListener('select_chat_session', handle);
  }, []);

  const handleSend = () => sendMessage(input, selectedFiles);
  const handleChipClick = (chip: typeof SUGGESTION_CHIPS[0]) => sendMessage(chip.prompt);
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setSelectedFiles(prev => [...prev, ...Array.from(e.target.files!)]);
  };

  const showMessages = messages.length > 0 || isLoading || !!streamingContent;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="flex h-full relative overflow-hidden"
      style={{ background: '#030014', fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      {/* ── Main Chat Area ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col h-full relative min-w-0">

        {/* ── Sleek Top Header with New Chat ────────────────── */}
        <div
          className="flex items-center justify-between px-4 py-3 flex-shrink-0"
          style={{
            borderBottom: '1px solid rgba(255,255,255,0.04)',
            background: 'rgba(3,0,20,0.6)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)' }}>
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-semibold" style={{ color: '#f1f5f9' }}>Ama AI Assistant</span>
          </div>

          <button
            onClick={() => { setActiveSessionId(null); setHistoryOpen(false); }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shadow-lg hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: 'linear-gradient(135deg, #6366f1, #a855f7)',
              color: '#fff',
              boxShadow: '0 4px 12px rgba(99,102,241,0.2)'
            }}
          >
            <Plus className="w-3.5 h-3.5" /> New Chat
          </button>
        </div>

        {/* ── Messages or Welcome ──────────────────────────────────────── */}
        {!showMessages ? (
          /* Welcome screen */
          <div className="flex-1 flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-2xl mx-auto">
              <motion.div
                className="text-center mb-10"
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              >
                <div className="flex items-center justify-center mb-5">
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', boxShadow: '0 0 60px rgba(99,102,241,0.4)' }}
                  >
                    <Sparkles className="w-8 h-8 text-white" />
                  </div>
                </div>
                <h1 className="text-3xl font-bold mb-2" style={{ color: '#f1f5f9' }}>{greeting}</h1>
                <p className="text-base" style={{ color: '#475569' }}>How can I assist you today?</p>

                {/* Gmail connection badge */}
                <div className="flex justify-center mt-4">
                  {gmailEmail ? (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
                      style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', color: '#4ade80' }}>
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Gmail connected · {gmailEmail}
                    </div>
                  ) : (
                    <a href="#email"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                      style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', color: '#818cf8' }}
                    >
                      <ExternalLink className="w-3 h-3" /> Connect Gmail to send emails
                    </a>
                  )}
                </div>
              </motion.div>

              {/* Center input on welcome */}
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.5 }}>
                <InputBar
                  input={input} setInput={setInput} textareaRef={textareaRef}
                  selectedFiles={selectedFiles}
                  onRemoveFile={i => setSelectedFiles(prev => prev.filter((_, idx) => idx !== i))}
                  fileInputRef={fileInputRef} onFileSelect={handleFileSelect}
                  onSend={handleSend} isLoading={isLoading} onStop={stopGeneration}
                />
              </motion.div>

              {/* Suggestion chips */}
              <motion.div
                className="flex flex-wrap justify-center gap-2 mt-6"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
              >
                {SUGGESTION_CHIPS.map((chip, i) => {
                  const Icon = chip.icon;
                  return (
                    <motion.button
                      key={chip.id}
                      onClick={() => handleChipClick(chip)}
                      initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.3 + i * 0.05 }}
                      whileHover={{ scale: 1.04, y: -1 }}
                      whileTap={{ scale: 0.97 }}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-medium transition-all"
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        color: '#94a3b8',
                      }}
                    >
                      <Icon className="w-3.5 h-3.5" style={{ color: '#6366f1' }} />
                      {chip.label}
                    </motion.button>
                  );
                })}
              </motion.div>
            </div>
          </div>
        ) : (
          /* Messages */
          <>
            <div
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto"
              style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.06) transparent' }}
            >
              <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
                <AnimatePresence initial={false}>
                  {messages.map((msg, idx) => {
                    const isLast = idx === messages.length - 1;
                    const isLastAssistant = isLast && msg.role === 'assistant' && !isLoading;
                    return (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, ease: 'easeOut' }}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        {msg.role === 'assistant' && (
                          <div className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mr-3 mt-0.5"
                            style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)', boxShadow: '0 0 16px rgba(99,102,241,0.3)' }}>
                            <Sparkles className="w-3.5 h-3.5 text-white" />
                          </div>
                        )}
                        <div className="flex flex-col gap-1 max-w-[85%] group">
                          <div
                            className={`rounded-2xl ${msg.role === 'user' ? 'px-4 py-3' : 'px-5 py-4'}`}
                            style={msg.role === 'user' ? {
                              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                              color: '#fff',
                              boxShadow: '0 4px 24px rgba(99,102,241,0.3)',
                            } : {
                              background: 'rgba(255,255,255,0.04)',
                              border: '1px solid rgba(255,255,255,0.07)',
                              backdropFilter: 'blur(12px)',
                            }}
                          >
                            {msg.role === 'user' ? (
                              <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: '#fff' }}>{msg.content}</p>
                            ) : (
                              <div className="text-sm">
                                <MarkdownContent content={msg.content} />
                              </div>
                            )}
                            {msg.files && msg.files.length > 0 && (
                              <div className="space-y-1 mt-2">
                                {msg.files.map((f: any, fi: number) => (
                                  <div key={fi} className="flex items-center gap-2 p-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.08)' }}>
                                    {f.type?.startsWith('image/') ? <ImageIcon className="w-4 h-4" style={{ color: '#a78bfa' }} /> : <FileText className="w-4 h-4" style={{ color: '#a78bfa' }} />}
                                    <span className="text-xs truncate" style={{ color: '#94a3b8' }}>{f.name || 'Attachment'}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            
                            {/* Message-level copy button for AI responses */}
                            {msg.role === 'assistant' && (
                              <MsgCopyButton content={msg.content} />
                            )}
                          </div>

                          {/* Regenerate button — under last assistant message */}
                          {isLastAssistant && (
                            <motion.button
                              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                              onClick={regenerate}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium self-start transition-all"
                              style={{ color: '#475569', background: 'transparent' }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLElement).style.color = '#94a3b8'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#475569'; }}
                            >
                              <RefreshCw className="w-3 h-3" /> Regenerate
                            </motion.button>
                          )}

                          {/* Email confirmation card — shown after SEND_EMAIL action */}
                          {isLastAssistant && pendingEmail && (
                            <motion.div
                              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                              className="mt-3 rounded-2xl overflow-hidden self-stretch"
                              style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)' }}
                            >
                              <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid rgba(99,102,241,0.12)', background: 'rgba(99,102,241,0.08)' }}>
                                <Mail className="w-4 h-4" style={{ color: '#818cf8' }} />
                                <span className="text-xs font-semibold" style={{ color: '#a5b4fc' }}>Email Draft — Review before sending</span>
                              </div>
                              <div className="px-4 py-3 space-y-2 text-xs" style={{ color: '#94a3b8' }}>
                                <div><span className="font-medium" style={{ color: '#e2e8f0' }}>To:</span> {pendingEmail.to}</div>
                                <div><span className="font-medium" style={{ color: '#e2e8f0' }}>Subject:</span> {pendingEmail.subject}</div>
                                <div className="pt-1" style={{ color: '#cbd5e1', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{pendingEmail.body}</div>
                              </div>
                              {emailSentMsg ? (
                                <div className="px-4 py-3 text-xs font-medium flex items-center gap-2" style={{ color: '#4ade80', background: 'rgba(34,197,94,0.06)' }}>
                                  <Check className="w-4 h-4" /> {emailSentMsg}
                                </div>
                              ) : (
                                <div className="px-4 py-3 flex items-center gap-2" style={{ borderTop: '1px solid rgba(99,102,241,0.12)' }}>
                                  {!gmailEmail ? (
                                    <p className="text-xs" style={{ color: '#f87171' }}>⚠️ Gmail not connected. Go to the Email tab to connect first.</p>
                                  ) : (
                                    <>
                                      <motion.button
                                        whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                        disabled={sendingEmail}
                                        onClick={async () => {
                                          if (!pendingEmail || !gmailEmail) return;
                                          setSendingEmail(true);
                                          try {
                                            const token = localStorage.getItem('authToken');
                                            const r = await fetch(`${API_BASE}/api/ama/send-email`, {
                                              method: 'POST',
                                              headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                                              body: JSON.stringify({ gmailEmail, ...pendingEmail }),
                                            });
                                            const d = await r.json();
                                            if (r.ok) {
                                              setEmailSentMsg(`✅ Sent to ${pendingEmail.to}`);
                                              setPendingEmail(null);
                                            } else {
                                              setEmailSentMsg(`❌ ${d.message || 'Send failed'}`);
                                            }
                                          } catch (e: any) {
                                            setEmailSentMsg(`❌ Network error: ${e.message}`);
                                          } finally {
                                            setSendingEmail(false);
                                          }
                                        }}
                                        className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                                        style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)', color: '#fff' }}
                                      >
                                        {sendingEmail ? 'Sending…' : '🚀 Send Email'}
                                      </motion.button>
                                      <motion.button
                                        whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                        onClick={() => { setPendingEmail(null); setEmailSentMsg(''); }}
                                        className="px-4 py-1.5 rounded-lg text-xs font-medium transition-all"
                                        style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
                                      >
                                        Cancel
                                      </motion.button>
                                    </>
                                  )}
                                </div>
                              )}
                            </motion.div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>

                {/* Streaming message */}
                {(isLoading || streamingContent) && (
                  <motion.div
                    initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                    className="flex justify-start"
                  >
                    <div className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mr-3 mt-0.5"
                      style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)', boxShadow: '0 0 16px rgba(99,102,241,0.3)' }}>
                      <Sparkles className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div
                      className="rounded-2xl px-5 py-4 max-w-[85%]"
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.07)',
                        backdropFilter: 'blur(12px)',
                      }}
                    >
                      {streamingContent ? (
                        <div className="text-sm">
                          <MarkdownContent content={streamingContent} />
                          <motion.span
                            className="inline-block w-0.5 h-4 ml-0.5 rounded-full align-middle"
                            style={{ background: '#6366f1' }}
                            animate={{ opacity: [1, 0] }}
                            transition={{ duration: 0.7, repeat: Infinity }}
                          />
                        </div>
                      ) : (
                        <TypingIndicator />
                      )}
                    </div>
                  </motion.div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Scroll-to-bottom button */}
            <AnimatePresence>
              {showScrollBtn && (
                <motion.button
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                  onClick={() => { setUserScrolled(false); scrollToBottom(true); }}
                  className="absolute bottom-28 right-6 w-9 h-9 rounded-full flex items-center justify-center shadow-lg z-10"
                  style={{ background: 'rgba(99,102,241,0.9)', color: '#fff', backdropFilter: 'blur(8px)' }}
                >
                  <ChevronDown className="w-4 h-4" />
                </motion.button>
              )}
            </AnimatePresence>

            {/* Input bar */}
            <div
              className="px-4 pb-4 pt-3 flex-shrink-0"
              style={{ background: 'rgba(3,0,20,0.8)', backdropFilter: 'blur(16px)', borderTop: '1px solid rgba(255,255,255,0.04)', paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
            >
              <div className="max-w-3xl mx-auto">
                <InputBar
                  input={input} setInput={setInput} textareaRef={textareaRef}
                  selectedFiles={selectedFiles}
                  onRemoveFile={i => setSelectedFiles(prev => prev.filter((_, idx) => idx !== i))}
                  fileInputRef={fileInputRef} onFileSelect={handleFileSelect}
                  onSend={handleSend} isLoading={isLoading} onStop={stopGeneration}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── InputBar ──────────────────────────────────────────────────────────────────
function InputBar({
  input, setInput, textareaRef, selectedFiles, onRemoveFile,
  fileInputRef, onFileSelect, onSend, isLoading, onStop,
}: {
  input: string;
  setInput: (v: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  selectedFiles: File[];
  onRemoveFile: (i: number) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSend: () => void;
  isLoading: boolean;
  onStop: () => void;
}) {
  const [isListening, setIsListening] = useState(false);

  const handleVoice = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('Voice recognition not supported in this browser.'); return; }
    const rec = new SR();
    rec.continuous = false; rec.interimResults = false; rec.lang = 'en-US';
    rec.onstart = () => setIsListening(true);
    rec.onresult = (e: any) => { const t = e.results[0][0].transcript; setInput(input + (input ? ' ' : '') + t); };
    rec.onerror = rec.onend = () => setIsListening(false);
    rec.start();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!isLoading) onSend(); }
  };

  return (
    <>
      {selectedFiles.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {selectedFiles.map((f, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8' }}>
              {f.type.startsWith('image/') ? <ImageIcon className="w-3.5 h-3.5" style={{ color: '#a78bfa' }} /> : <FileText className="w-3.5 h-3.5" style={{ color: '#a78bfa' }} />}
              <span className="truncate max-w-[120px]">{f.name}</span>
              <button onClick={() => onRemoveFile(i)} style={{ color: '#475569' }}><X className="w-3 h-3" /></button>
            </div>
          ))}
        </div>
      )}

      <div
        className="flex items-end gap-2 rounded-2xl px-3 py-2"
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          backdropFilter: 'blur(16px)',
          boxShadow: '0 0 0 1px rgba(99,102,241,0.08), 0 8px 32px rgba(0,0,0,0.4)',
        }}
      >
        <input type="file" ref={fileInputRef} onChange={onFileSelect} multiple className="hidden" />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-2 rounded-xl flex-shrink-0 transition-all mb-0.5"
          style={{ color: '#475569' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#818cf8'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#475569'}
          title="Attach file"
        >
          <Paperclip className="w-5 h-5" />
        </button>

        <textarea
          id="chat-input"
          ref={textareaRef}
          rows={1}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Ama anything… (Shift+Enter for newline)"
          disabled={isLoading && !input}
          className="flex-1 py-2 bg-transparent focus:outline-none text-sm resize-none overflow-hidden"
          style={{
            color: '#f1f5f9',
            minHeight: '36px',
            maxHeight: '140px',
            lineHeight: '1.5',
            caretColor: '#6366f1',
          }}
        />

        <button
          onClick={handleVoice}
          className={`p-2 rounded-xl flex-shrink-0 mb-0.5 transition-all ${isListening ? 'animate-pulse' : ''}`}
          style={{ color: isListening ? '#ef4444' : '#475569' }}
          onMouseEnter={e => { if (!isListening) (e.currentTarget as HTMLElement).style.color = '#818cf8'; }}
          onMouseLeave={e => { if (!isListening) (e.currentTarget as HTMLElement).style.color = '#475569'; }}
          title="Voice input"
        >
          <Mic className="w-5 h-5" />
        </button>

        {isLoading ? (
          <motion.button
            onClick={onStop}
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            className="flex-shrink-0 mb-0.5 w-9 h-9 rounded-xl flex items-center justify-center transition-all"
            style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}
            title="Stop generation"
          >
            <Square className="w-4 h-4 fill-current" />
          </motion.button>
        ) : (
          <motion.button
            id="chat-send-btn"
            onClick={onSend}
            disabled={!input.trim() && selectedFiles.length === 0}
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            className="flex-shrink-0 mb-0.5 w-9 h-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)', boxShadow: '0 4px 16px rgba(99,102,241,0.4)', color: '#fff' }}
            title="Send"
          >
            <Send className="w-4 h-4" />
          </motion.button>
        )}
      </div>
      <p className="text-center text-xs mt-2" style={{ color: '#1e293b' }}>
        Ama can make mistakes. Verify important information.
      </p>
    </>
  );
}
