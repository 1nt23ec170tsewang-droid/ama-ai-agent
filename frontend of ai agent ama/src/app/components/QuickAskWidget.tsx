import { useState } from 'react';
import { Brain, Mic, Loader2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useSettings } from '../context/SettingsContext';

export function QuickAskWidget() {
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const { tasks, events, team, addTask, addEvent, addTeamMember } = useApp();
  const { user } = useAuth();
  const { aiSettings } = useSettings();
  const { showToast, removeToast } = useToast();

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
- User: ${user?.name || 'Executive'}
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

In addition to managing tasks, you are fully capable of answering general or out-of-the-box questions. Provide highly intelligent, accurate, and rapid responses to support a real-time conversational experience. Keep responses under 50 words unless explicitly asked for more detail.`;
  };

  const handleAskText = async (userText: string) => {
    if (!userText.trim()) return;

    setIsLoading(true);
    const toastId = showToast('Ama is processing voice command...', 'loading');

    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch('http://localhost:5000/api/ama/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: userText }],
          systemPrompt: buildSystemPrompt(),
          userContext: {
            name: user?.name,
            email: user?.email,
          },
        }),
      });

      const data = await res.json();
      removeToast(toastId);
      
      if (res.ok && data.response) {
        let content = data.response;
        let actionTaken = false;
        
        // Parse JSON blocks for actions
        const jsonBlockRegex = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/gi;
        let match;
        while ((match = jsonBlockRegex.exec(content)) !== null) {
          try {
            const parsed = JSON.parse(match[1]);
            if (parsed.action === 'CREATE_TASK' && parsed.task) {
              const dueDate = parsed.task.dueDate || new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
              addTask({ ...parsed.task, dueDate, status: 'todo', completed: false });
              showToast(`Task created: ${parsed.task.title}`, 'success');
              actionTaken = true;
            } else if (parsed.action === 'CREATE_EVENT' && parsed.event) {
              const date = parsed.event.date || new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
              addEvent({ ...parsed.event, date });
              showToast(`Event scheduled: ${parsed.event.title}`, 'success');
              actionTaken = true;
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
              actionTaken = true;
            }
          } catch (e) {
            console.error('Failed to parse AI action JSON:', e);
          }
        }
        
        content = content.replace(/```(?:json)?\s*\{[\s\S]*?\}\s*```/gi, '').trim();
        if (content) {
          showToast(content, actionTaken ? 'success' : 'info');
        } else if (!actionTaken) {
          showToast('Voice command executed successfully!', 'success');
        }

      } else {
        const errMsg = data.error || data.message || 'AI response failed.';
        showToast(`AI error: ${errMsg.slice(0, 80)}`, 'error');
      }
    } catch (e) {
      removeToast(toastId);
      showToast('Network error processing request', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoiceAsk = () => {
    if (isListening || isLoading) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast("Your browser does not support Voice Recognition.", 'error');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      showToast('Listening...', 'info');
    };
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      showToast(`Heard: "${transcript}"`, 'info');
      handleAskText(transcript);
    };
    recognition.onerror = (event: any) => {
      console.error(event);
      setIsListening(false);
      showToast("Voice recognition failed. Please try again.", 'error');
    };
    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end">
      <button
        onClick={handleVoiceAsk}
        disabled={isLoading || isListening}
        title="Voice Command Mode"
        className={`w-14 h-14 rounded-full flex items-center justify-center shadow-xl text-white transition-all ${
          isListening 
            ? 'bg-red-500 animate-pulse shadow-red-500/50 scale-110' 
            : 'bg-gradient-to-br from-amber-500 to-orange-600 shadow-orange-500/30 hover:scale-105 hover:shadow-2xl'
        }`}
      >
        {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Mic className="w-6 h-6" />}
      </button>
    </div>
  );
}
