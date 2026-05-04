require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const admin = require('firebase-admin');
const path = require('path');
const { google } = require('googleapis');

// ──────────────────────────────────────────
// FIREBASE ADMIN INIT
// ──────────────────────────────────────────
let db = null;
try {
  const serviceAccount = require(path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  db = admin.firestore();
  console.log('✅ Firebase Admin connected');
} catch (err) {
  console.warn('⚠️  Firebase not configured — using in-memory store. Error:', err.message);
}

// ──────────────────────────────────────────
// GEMINI AI INIT (fallback)
// ──────────────────────────────────────────
let geminiModel = null;
try {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  geminiModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  console.log('✅ Gemini AI connected (gemini-1.5-flash) — used as fallback');
} catch (err) {
  console.warn('⚠️  Gemini not configured:', err.message);
}

// ──────────────────────────────────────────
// OPENROUTER AI (Primary — GPT-4.1 via OpenRouter)
// ──────────────────────────────────────────
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL   = 'openai/gpt-4.1';  // ChatGPT 4.1 via OpenRouter

if (OPENROUTER_API_KEY) {
  console.log('✅ OpenRouter AI configured (gpt-4.1) — primary AI provider');
} else {
  console.warn('⚠️  OPENROUTER_API_KEY not set — will fall back to Gemini');
}

/** Call OpenRouter (ChatGPT 4.1) with a plain text prompt */
async function askOpenRouter(prompt, systemPrompt = 'You are Ama, an AI Chief of Staff.') {
  if (!OPENROUTER_API_KEY) throw new Error('OpenRouter API key not configured.');
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:5173',
      'X-Title': 'Ama AI Chief of Staff',
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: prompt },
      ],
      max_tokens: 1024,
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${errText}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

/** Call OpenRouter with a full messages array (for multi-turn chat) */
async function askOpenRouterMessages(messages, systemPrompt = 'You are Ama, an AI Chief of Staff.') {
  if (!OPENROUTER_API_KEY) throw new Error('OpenRouter API key not configured.');
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:5173',
      'X-Title': 'Ama AI Chief of Staff',
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      max_tokens: 1024,
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${errText}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

/** Primary AI call: tries OpenRouter first, falls back to Gemini */
async function askAI(prompt, systemPrompt) {
  if (OPENROUTER_API_KEY) {
    try {
      return await askOpenRouter(prompt, systemPrompt);
    } catch (err) {
      console.warn('⚠️ OpenRouter failed, falling back to Gemini:', err.message);
    }
  }
  return await askGemini(prompt);
}

const app = express();
const PORT = process.env.PORT || 5000;
const SECRET_KEY = process.env.JWT_SECRET || 'ama_fallback_secret';

// ──────────────────────────────────────────
// MIDDLEWARE
// ──────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json());

// In-memory fallback if Firestore is not configured
const inMemoryUsers = [];

// ──────────────────────────────────────────
// JWT MIDDLEWARE
// ──────────────────────────────────────────
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Access Denied: No token provided.' });
  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid or Expired Token.' });
    req.user = user;
    next();
  });
};

// Optional auth: attaches user if token present, but always calls next()
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    req.user = { id: 'guest', name: 'User', email: '', company: '', role: '' };
    return next();
  }
  jwt.verify(token, SECRET_KEY, (err, user) => {
    req.user = err ? { id: 'guest', name: 'User', email: '', company: '', role: '' } : user;
    next();
  });
};

// ──────────────────────────────────────────
// HELPER: Call Gemini safely with retry + backoff (fallback)
// ──────────────────────────────────────────
async function askGemini(prompt, retries = 2, delayMs = 3000) {
  if (!geminiModel) throw new Error('Gemini API not configured. Add GEMINI_API_KEY to .env');
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await geminiModel.generateContent(prompt);
      return result.response.text();
    } catch (err) {
      const is429 = err.status === 429 || (err.message && err.message.includes('429'));
      const isPermanentQuota = err.message && err.message.includes('limit: 0');

      if (is429 && isPermanentQuota) {
        throw new Error(
          'Gemini API quota is 0 for this project. Please create a new API key at ' +
          'https://aistudio.google.com/app/apikey using "Create API key in new project".'
        );
      }
      if (is429 && attempt < retries) {
        const retryMatch = err.message && err.message.match(/retryDelay":"(\d+)s/);
        const waitSec = retryMatch ? Math.min(parseInt(retryMatch[1]), 8) : attempt * 3;
        console.warn(`⏳ Gemini 429 — retrying in ${waitSec}s (attempt ${attempt}/${retries})`);
        await new Promise(r => setTimeout(r, waitSec * 1000));
      } else {
        throw err;
      }
    }
  }
}


// ──────────────────────────────────────────
// HEALTH CHECK
// ──────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    firebase: db ? 'connected' : 'not configured',
    openrouter: OPENROUTER_API_KEY ? 'connected' : 'not configured',
    gemini: geminiModel ? 'connected (fallback)' : 'not configured',
    timestamp: new Date().toISOString(),
  });
});

// ══════════════════════════════════════════
// AUTH ROUTES
// ══════════════════════════════════════════

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, company, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userData = { id: Date.now().toString(), name, email, company: company || '', role: role || '', createdAt: new Date().toISOString() };

    if (db) {
      // Check existing user in Firestore
      const existing = await db.collection('users').where('email', '==', email).get();
      if (!existing.empty) return res.status(400).json({ message: 'User already exists.' });

      await db.collection('users').doc(userData.id).set({ ...userData, password: hashedPassword });
    } else {
      // In-memory fallback
      if (inMemoryUsers.find(u => u.email === email)) {
        return res.status(400).json({ message: 'User already exists.' });
      }
      inMemoryUsers.push({ ...userData, password: hashedPassword });
    }

    const token = jwt.sign({ id: userData.id, email, name, company: company || '', role: role || '' }, SECRET_KEY, { expiresIn: '7d' });
    res.status(201).json({ message: 'Registration successful', token, user: { id: userData.id, name, email, company, role } });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error during registration.', error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password required.' });

    let foundUser = null;

    if (db) {
      const snap = await db.collection('users').where('email', '==', email).get();
      if (!snap.empty) foundUser = { id: snap.docs[0].id, ...snap.docs[0].data() };
    } else {
      foundUser = inMemoryUsers.find(u => u.email === email);
    }

    if (!foundUser) return res.status(400).json({ message: 'Invalid credentials.' });

    const isMatch = await bcrypt.compare(password, foundUser.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials.' });

    // Update last login
    if (db) {
      await db.collection('users').doc(foundUser.id).update({ lastLogin: new Date().toISOString() });
    }

    const token = jwt.sign(
      { id: foundUser.id, email: foundUser.email, name: foundUser.name, company: foundUser.company, role: foundUser.role },
      SECRET_KEY,
      { expiresIn: '7d' }
    );

    res.status(200).json({
      message: 'Login successful',
      token,
      user: { id: foundUser.id, name: foundUser.name, email: foundUser.email, company: foundUser.company, role: foundUser.role }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login.', error: error.message });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    let userProfile = req.user;
    if (db) {
      const snap = await db.collection('users').doc(req.user.id).get();
      if (snap.exists) userProfile = { id: snap.id, ...snap.data() };
    }
    const { password, ...safeProfile } = userProfile;
    res.json({ user: safeProfile });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching profile.' });
  }
});

app.put('/api/auth/profile', authenticateToken, async (req, res) => {
  try {
    const { name, company, role } = req.body;
    const updates = { name, company, role, updatedAt: new Date().toISOString() };
    if (db) {
      await db.collection('users').doc(req.user.id).update(updates);
    }
    res.json({ message: 'Profile updated successfully', user: { ...req.user, ...updates } });
  } catch (error) {
    res.status(500).json({ message: 'Error updating profile.' });
  }
});

// ══════════════════════════════════════════
// GEMINI AI ROUTES
// ══════════════════════════════════════════

// Morning Briefing
app.post('/api/ama/briefing', authenticateToken, async (req, res) => {
  try {
    const { date } = req.body;
    const user = req.user;
    const today = date || new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const prompt = `You are Ama, an executive AI Chief of Staff. Generate a concise, professional morning briefing for ${user.name}${user.company ? `, ${user.role || 'Executive'} at ${user.company}` : ''}.

Date: ${today}

Structure the briefing with these sections:
1. **Executive Summary** – 2 sentences on the day's theme
2. **Top 3 Priorities** – numbered, action-oriented
3. **Key Risks to Watch** – 2 bullet points
4. **Focus Recommendation** – 1 sentence on what to protect time for
5. **Motivational Close** – 1 powerful sentence

Keep it sharp, executive-level. No fluff. Total under 200 words.`;

    const text = await askAI(prompt);

    // Cache in Firestore if available
    if (db) {
      const todayKey = new Date().toISOString().split('T')[0];
      await db.collection('briefings').doc(`${user.id}_${todayKey}`).set({
        userId: user.id, date: todayKey, content: text, createdAt: new Date().toISOString()
      });
    }

    res.json({ briefing: text, generatedAt: new Date().toISOString() });
  } catch (error) {
    console.error('Briefing error:', error);
    res.status(500).json({ message: 'Failed to generate briefing.', error: error.message });
  }
});

// Chat with Ama
app.post('/api/ama/chat', optionalAuth, async (req, res) => {
  try {
    const { messages, userContext } = req.body;
    const user = req.user;

    if (!messages || !messages.length) {
      return res.status(400).json({ message: 'Messages are required.' });
    }

    // Merge userContext from body with req.user (body takes priority for name/company)
    const ctx = {
      name: userContext?.name || user.name || 'User',
      company: userContext?.company || user.company || '',
      role: userContext?.role || user.role || '',
      email: userContext?.email || user.email || '',
    };

    // Build system prompt
    let systemContext = req.body.systemPrompt || `You are Ama, a highly intelligent AI Chief of Staff for ${ctx.name}${ctx.company ? ` at ${ctx.company}` : ''}${ctx.role ? `, ${ctx.role}` : ''}.
You are proactive, concise, and strategic.`;

    systemContext += `\n\nIMPORTANT SCHEDULING RULES:
- When a user asks to schedule a meeting or create a task, DO NOT ask deep or clarifying questions (like attendees, preferred time, etc.) unless absolutely necessary.
- Use reasonable defaults if information is missing (e.g., if no date is provided, assume today or tomorrow; if no time, assume a reasonable business hour; if no attendees, just schedule it for the user).
- CRITICAL: Immediately output the EXACT JSON block as instructed in your LIVE CONTEXT to create the task/event. Do NOT just say you will do it or ask for permission.`;

    let response;

    // Prefer OpenRouter (multi-turn messages API)
    if (OPENROUTER_API_KEY) {
      try {
        // Convert message history to OpenAI format
        const openAIMessages = messages.map(m => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content,
        }));
        response = await askOpenRouterMessages(openAIMessages, systemContext);
      } catch (orErr) {
        console.warn('⚠️ OpenRouter chat failed, falling back to Gemini:', orErr.message);
        const conversationHistory = messages.map(m => `${m.role === 'user' ? 'User' : 'Ama'}: ${m.content}`).join('\n');
        const fullPrompt = `${systemContext}\n\nConversation:\n${conversationHistory}\n\nAma:`;
        response = await askGemini(fullPrompt);
      }
    } else {
      const conversationHistory = messages.map(m => `${m.role === 'user' ? 'User' : 'Ama'}: ${m.content}`).join('\n');
      const fullPrompt = `${systemContext}\n\nConversation:\n${conversationHistory}\n\nAma:`;
      response = await askGemini(fullPrompt);
    }

    // Save to Firestore
    if (db) {
      const sessionId = req.body.sessionId || Date.now().toString();
      await db.collection('conversations').add({
        userId: user.id,
        sessionId,
        userMessage: messages[messages.length - 1]?.content,
        amaResponse: response,
        timestamp: new Date().toISOString()
      });
    }

    res.json({ response, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ message: 'Failed to get AI response.', error: error.message });
  }
});

// Summarize Email
app.post('/api/ama/summarize-email', authenticateToken, async (req, res) => {
  try {
    const { sender, subject, body } = req.body;
    const prompt = `You are an executive assistant. Summarize this email in exactly 3 concise bullet points for a busy CEO.

From: ${sender}
Subject: ${subject}
Body: ${body}

Format:
• [Key point 1]
• [Key point 2]  
• [Required action, if any]

Keep each bullet under 15 words. Executive-level language only.`;

    const summary = await askAI(prompt);
    res.json({ summary });
  } catch (error) {
    res.status(500).json({ message: 'Failed to summarize email.', error: error.message });
  }
});

// Draft Email Reply
app.post('/api/ama/draft-reply', authenticateToken, async (req, res) => {
  try {
    const { sender, subject, body, senderName } = req.body;
    const user = req.user;
    const prompt = `Draft a professional email reply for ${user.name} to respond to this email. 

From: ${senderName || sender}
Subject: ${subject}
Email: ${body}

Requirements:
- CEO/executive voice: confident, warm, decisive
- Under 100 words
- Address the sender by first name
- Clear next step or action
- Professional sign-off with "${user.name}"
- No fluff, no filler phrases

Write ONLY the email body, starting with the greeting.`;

    const draft = await askAI(prompt);
    res.json({ draft });
  } catch (error) {
    res.status(500).json({ message: 'Failed to draft reply.', error: error.message });
  }
});

// Prioritize Tasks
app.post('/api/ama/prioritize-tasks', authenticateToken, async (req, res) => {
  try {
    const { tasks } = req.body;
    if (!tasks || !tasks.length) return res.status(400).json({ message: 'Tasks array required.' });

    const taskList = tasks.map((t, i) => `${i + 1}. ${t.title} — Priority: ${t.priority || 'medium'}, Due: ${t.dueDate || 'no deadline'}`).join('\n');

    const prompt = `You are an executive Chief of Staff. Analyze these tasks and identify the top 3 priorities.

Tasks:
${taskList}

For each top priority, provide:
- Task name
- Why it's most urgent (1 sentence, impact-focused)
- Recommended time block (e.g., "Handle first thing tomorrow morning")

Format as:
**#1: [Task Name]**
Why: [reason]
When: [time recommendation]

Be decisive and strategic. Think like a CEO's right hand.`;

    const analysis = await askAI(prompt);
    res.json({ analysis });
  } catch (error) {
    res.status(500).json({ message: 'Failed to prioritize tasks.', error: error.message });
  }
});

// Break Down Task
app.post('/api/ama/breakdown-task', authenticateToken, async (req, res) => {
  try {
    const { title, description } = req.body;
    const prompt = `Break down this task into 4-6 concrete, actionable subtasks.

Task: ${title}
Description: ${description || 'No additional description'}

Format as a numbered list. Each subtask must:
- Start with an action verb
- Be completable in under 2 hours
- Be specific enough to execute immediately

Number them 1-6 maximum. No explanations, just the subtasks.`;

    const breakdown = await askAI(prompt);
    res.json({ breakdown });
  } catch (error) {
    res.status(500).json({ message: 'Failed to break down task.', error: error.message });
  }
});

// Generate Analytics Insight
app.post('/api/ama/analytics-insight', authenticateToken, async (req, res) => {
  try {
    const { metrics } = req.body;
    const metricsText = Object.entries(metrics || {}).map(([k, v]) => `${k}: ${v}`).join('\n');

    const prompt = `You are a strategic business analyst and Chief of Staff. Analyze these business metrics and provide executive insights.

Metrics:
${metricsText}

Provide:
**3 Key Insights:**
1. [Insight with specific metric reference]
2. [Insight with trend analysis]
3. [Insight with opportunity or concern]

**2 Risks to Watch:**
• [Risk 1 with recommended mitigation]
• [Risk 2 with recommended mitigation]

Be specific, data-driven, and strategic. No generic observations.`;

    const insight = await askAI(prompt);
    res.json({ insight });
  } catch (error) {
    res.status(500).json({ message: 'Failed to generate insights.', error: error.message });
  }
});

// Team Performance Note
app.post('/api/ama/performance-note', authenticateToken, async (req, res) => {
  try {
    const { memberName, role, completedTasks, kpi, notes } = req.body;

    const prompt = `Write a 3-4 sentence performance note for a team member. This will be used for a 1:1 meeting or performance review.

Team Member: ${memberName}
Role: ${role}
Tasks Completed: ${completedTasks || 'N/A'}
KPI Score: ${kpi || 'N/A'}
Manager Notes: ${notes || 'No additional notes'}

Requirements:
- Start with genuine recognition of a specific strength
- Acknowledge one area of growth with constructive framing  
- End with an encouraging, forward-looking statement
- Tone: warm, professional, like a supportive manager
- 3-4 sentences maximum`;

    const note = await askAI(prompt);
    res.json({ note });
  } catch (error) {
    res.status(500).json({ message: 'Failed to generate performance note.', error: error.message });
  }
});

// ══════════════════════════════════════════
// TASKS ROUTES (Firestore)
// ══════════════════════════════════════════

app.get('/api/tasks', authenticateToken, async (req, res) => {
  try {
    if (!db) return res.json([]);
    const snap = await db.collection('tasks').where('userId', '==', req.user.id).get();
    const tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching tasks.' });
  }
});

app.post('/api/tasks', authenticateToken, async (req, res) => {
  try {
    const task = {
      ...req.body,
      userId: req.user.id,
      createdAt: new Date().toISOString(),
      col: req.body.col || 'todo',
      subtasks: [],
    };
    if (db) {
      const ref = await db.collection('tasks').add(task);
      return res.status(201).json({ id: ref.id, ...task });
    }
    res.status(201).json({ id: Date.now().toString(), ...task });
  } catch (error) {
    res.status(500).json({ message: 'Error creating task.' });
  }
});

app.put('/api/tasks/:id', authenticateToken, async (req, res) => {
  try {
    if (db) await db.collection('tasks').doc(req.params.id).update({ ...req.body, updatedAt: new Date().toISOString() });
    res.json({ id: req.params.id, ...req.body });
  } catch (error) {
    res.status(500).json({ message: 'Error updating task.' });
  }
});

app.delete('/api/tasks/:id', authenticateToken, async (req, res) => {
  try {
    if (db) await db.collection('tasks').doc(req.params.id).delete();
    res.json({ message: 'Task deleted successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting task.' });
  }
});

// ══════════════════════════════════════════
// EVENTS ROUTES (Firestore — non-Google-Calendar events)
// ══════════════════════════════════════════

app.get('/api/events', authenticateToken, async (req, res) => {
  try {
    if (!db) return res.json([]);
    const snap = await db.collection('events').where('userId', '==', req.user.id).get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (error) {
    res.status(500).json({ message: 'Error fetching events.' });
  }
});

app.post('/api/events', authenticateToken, async (req, res) => {
  try {
    const event = { ...req.body, userId: req.user.id, createdAt: new Date().toISOString() };
    if (db) {
      const ref = await db.collection('events').add(event);
      return res.status(201).json({ id: ref.id, ...event });
    }
    res.status(201).json({ id: Date.now().toString(), ...event });
  } catch (error) {
    res.status(500).json({ message: 'Error creating event.' });
  }
});

app.put('/api/events/:id', authenticateToken, async (req, res) => {
  try {
    if (db) await db.collection('events').doc(req.params.id).update({ ...req.body, updatedAt: new Date().toISOString() });
    res.json({ id: req.params.id, ...req.body });
  } catch (error) {
    res.status(500).json({ message: 'Error updating event.' });
  }
});

app.delete('/api/events/:id', authenticateToken, async (req, res) => {
  try {
    if (db) await db.collection('events').doc(req.params.id).delete();
    res.json({ message: 'Event deleted successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting event.' });
  }
});

// ══════════════════════════════════════════
// METRICS ROUTES (Firestore)
// ══════════════════════════════════════════

app.get('/api/metrics', authenticateToken, async (req, res) => {
  try {
    if (!db) return res.json([]);
    const snap = await db.collection('metrics').where('userId', '==', req.user.id).get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (error) {
    res.status(500).json({ message: 'Error fetching metrics.' });
  }
});

app.post('/api/metrics', authenticateToken, async (req, res) => {
  try {
    const metric = { ...req.body, userId: req.user.id, createdAt: new Date().toISOString() };
    if (db) {
      const ref = await db.collection('metrics').add(metric);
      return res.status(201).json({ id: ref.id, ...metric });
    }
    res.status(201).json({ id: Date.now().toString(), ...metric });
  } catch (error) {
    res.status(500).json({ message: 'Error creating metric.' });
  }
});

app.put('/api/metrics/:id', authenticateToken, async (req, res) => {
  try {
    if (db) await db.collection('metrics').doc(req.params.id).update({ ...req.body, updatedAt: new Date().toISOString() });
    res.json({ id: req.params.id, ...req.body });
  } catch (error) {
    res.status(500).json({ message: 'Error updating metric.' });
  }
});

app.delete('/api/metrics/:id', authenticateToken, async (req, res) => {
  try {
    if (db) await db.collection('metrics').doc(req.params.id).delete();
    res.json({ message: 'Metric deleted successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting metric.' });
  }
});

// ══════════════════════════════════════════
// TEAM ROUTES (Firestore)
// ══════════════════════════════════════════

app.get('/api/team', authenticateToken, async (req, res) => {
  try {
    if (!db) return res.json([]);
    const snap = await db.collection('team').where('ownerId', '==', req.user.id).get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (error) {
    res.status(500).json({ message: 'Error fetching team.' });
  }
});

app.post('/api/team', authenticateToken, async (req, res) => {
  try {
    const member = { ...req.body, ownerId: req.user.id, createdAt: new Date().toISOString(), status: 'online' };
    if (db) {
      const ref = await db.collection('team').add(member);
      return res.status(201).json({ id: ref.id, ...member });
    }
    res.status(201).json({ id: Date.now().toString(), ...member });
  } catch (error) {
    res.status(500).json({ message: 'Error adding team member.' });
  }
});

app.put('/api/team/:id', authenticateToken, async (req, res) => {
  try {
    if (db) await db.collection('team').doc(req.params.id).update({ ...req.body, updatedAt: new Date().toISOString() });
    res.json({ id: req.params.id, ...req.body });
  } catch (error) {
    res.status(500).json({ message: 'Error updating team member.' });
  }
});

app.delete('/api/team/:id', authenticateToken, async (req, res) => {
  try {
    if (db) await db.collection('team').doc(req.params.id).delete();
    res.json({ message: 'Team member removed.' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting team member.' });
  }
});

// ══════════════════════════════════════════
// DASHBOARD DATA
// ══════════════════════════════════════════

app.get('/api/dashboard/briefing', authenticateToken, async (req, res) => {
  res.json({
    user: req.user.name,
    date: new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    topPriorities: ['Review Q3 planning deck', 'Follow up on investor intro email', 'Approve marketing budget'],
    unreadEmails: 0,
    pendingApprovals: 0,
  });
});

app.get('/api/dashboard/tasks', authenticateToken, async (req, res) => {
  try {
    if (!db) return res.json([]);
    const snap = await db.collection('tasks').where('userId', '==', req.user.id).where('col', '!=', 'done').get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (error) {
    res.json([]);
  }
});

// ══════════════════════════════════════════
// GMAIL OAUTH ROUTES
// ══════════════════════════════════════════

const GMAIL_CLIENT_ID     = process.env.GOOGLE_CLIENT_ID;
const GMAIL_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GMAIL_REDIRECT_URI  = process.env.GMAIL_REDIRECT_URI || `http://localhost:${process.env.PORT || 5000}/api/gmail/callback`;
const GMAIL_FRONTEND_URL  = process.env.FRONTEND_URL || 'http://localhost:5173';

// In-memory token store (keyed by gmail address) — persists as long as server is up.
const gmailTokenStore = new Map();

function makeOAuth2(tokens) {
  const c = new google.auth.OAuth2(GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REDIRECT_URI);
  if (tokens) {
    c.setCredentials(tokens);
    c.on('tokens', (t) => {
      if (t.refresh_token) tokens.refresh_token = t.refresh_token;
      tokens.access_token = t.access_token;
      tokens.expiry_date  = t.expiry_date;
    });
  }
  return c;
}

// GET /api/gmail/auth  — returns the Google OAuth consent URL
app.get('/api/gmail/auth', (req, res) => {
  try {
    const { login_hint } = req.query;
    const state = Math.random().toString(36).slice(2);
    const url = makeOAuth2().generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      state,
      ...(login_hint && { login_hint }),
      scope: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/calendar.readonly'
      ],
    });
    res.json({ url });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/gmail/callback  — Google redirects here after user approves
app.get('/api/gmail/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('Missing code');
  try {
    const oauth2 = makeOAuth2();
    const { tokens } = await oauth2.getToken(String(code));
    oauth2.setCredentials(tokens);
    const { data } = await google.oauth2({ version: 'v2', auth: oauth2 }).userinfo.get();
    gmailTokenStore.set(data.email, { tokens, email: data.email });
    console.log('✅ Gmail connected for:', data.email);
    // Redirect to /dashboard so the SPA router renders App (not the /login catch-all)
    res.redirect(`${GMAIL_FRONTEND_URL}/dashboard?gmail_connected=${encodeURIComponent(data.email)}`);
  } catch (err) {
    console.error('Gmail callback error:', err.message);
    res.redirect(`${GMAIL_FRONTEND_URL}/dashboard?gmail_error=${encodeURIComponent(err.message)}`);
  }
});


// GET /api/gmail/status?email=...
app.get('/api/gmail/status', (req, res) => {
  const connected = req.query.email ? gmailTokenStore.has(String(req.query.email)) : false;
  res.json({ connected });
});

// Helper: parse a raw Gmail message into our Email shape
function parseGmailMessage(msg) {
  const headers = msg.payload?.headers || [];
  const hdr = (n) => headers.find(h => h.name.toLowerCase() === n.toLowerCase())?.value || '';
  const from    = hdr('From');
  const m = from.match(/^(.+?)\s*<(.+?)>$/) || [];
  const fromName  = (m[1] || from).replace(/"/g, '').trim();
  const fromEmail = (m[2] || from).trim();

  let body = '';
  const extract = (part) => {
    if (!part) return;
    if (part.mimeType === 'text/plain' && part.body?.data)
      body = Buffer.from(part.body.data, 'base64').toString('utf-8');
    else if (part.parts) part.parts.forEach(extract);
  };
  extract(msg.payload);
  if (!body && msg.payload?.body?.data)
    body = Buffer.from(msg.payload.body.data, 'base64').toString('utf-8');

  const preview = body.replace(/\s+/g, ' ').slice(0, 130) + (body.length > 130 ? '…' : '');
  const labels  = msg.labelIds || [];
  const isRead  = !labels.includes('UNREAD');

  const rawDate = hdr('Date');
  const msgDate = rawDate ? new Date(rawDate) : new Date();
  const now     = new Date();
  const diffH   = (now - msgDate) / 3600000;
  const timeLabel =
    diffH < 24  ? msgDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) :
    diffH < 48  ? 'Yesterday' :
    msgDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return {
    id:             msg.id,
    threadId:       msg.threadId,
    from:           fromName || fromEmail,
    fromEmail,
    subject:        hdr('Subject') || '(no subject)',
    preview,
    body,
    time:           timeLabel,
    date:           msgDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    isRead,
    isStarred:      labels.includes('STARRED'),
    hasAttachments: (msg.payload?.parts || []).some(p => p.filename?.length > 0),
    labels,
    priority: 'normal',
    category: 'fyi',
  };
}

// GET /api/gmail/messages?email=...&maxResults=20
app.get('/api/gmail/messages', async (req, res) => {
  const { email, maxResults = 20 } = req.query;
  if (!email) return res.status(400).json({ message: 'email param required' });
  const stored = gmailTokenStore.get(String(email));
  if (!stored) return res.status(401).json({ message: 'Gmail not connected' });

  try {
    const auth   = makeOAuth2(stored.tokens);
    const gmail  = google.gmail({ version: 'v1', auth });
    const list   = await gmail.users.messages.list({ userId: 'me', labelIds: ['INBOX'], maxResults: Number(maxResults) });
    const ids    = (list.data.messages || []).map(m => m.id);
    if (!ids.length) return res.json({ emails: [] });
    const raw    = await Promise.all(ids.map(id => gmail.users.messages.get({ userId: 'me', id, format: 'full' }).then(r => r.data)));
    res.json({ emails: raw.map(parseGmailMessage) });
  } catch (err) {
    console.error('Gmail fetch error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// POST /api/gmail/archive  { email, messageId }
app.post('/api/gmail/archive', async (req, res) => {
  const { email, messageId } = req.body;
  const stored = gmailTokenStore.get(email);
  if (!stored) return res.status(401).json({ message: 'Gmail not connected' });
  try {
    const auth = makeOAuth2(stored.tokens);
    await google.gmail({ version: 'v1', auth }).users.messages.modify({ userId: 'me', id: messageId, requestBody: { removeLabelIds: ['INBOX'] } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/gmail/read  { email, messageId }
app.post('/api/gmail/read', async (req, res) => {
  const { email, messageId } = req.body;
  const stored = gmailTokenStore.get(email);
  if (!stored) return res.status(401).json({ message: 'Gmail not connected' });
  try {
    const auth = makeOAuth2(stored.tokens);
    await google.gmail({ version: 'v1', auth }).users.messages.modify({ userId: 'me', id: messageId, requestBody: { removeLabelIds: ['UNREAD'] } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/gmail/send  { email, to, subject, body, threadId }
app.post('/api/gmail/send', async (req, res) => {
  const { email, to, subject, body, threadId } = req.body;
  const stored = gmailTokenStore.get(email);
  if (!stored) return res.status(401).json({ message: 'Gmail not connected' });
  try {
    const auth = makeOAuth2(stored.tokens);
    const raw  = Buffer.from(`To: ${to}\r\nSubject: Re: ${subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}`).toString('base64url');
    await google.gmail({ version: 'v1', auth }).users.messages.send({ userId: 'me', requestBody: { raw, ...(threadId ? { threadId } : {}) } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ══════════════════════════════════════════
// GOOGLE CALENDAR ROUTES
// ══════════════════════════════════════════

// GET /api/calendar/events?email=...
app.get('/api/calendar/events', async (req, res) => {
  const { email, timeMin, timeMax } = req.query;
  if (!email) return res.status(400).json({ message: 'email param required' });
  const stored = gmailTokenStore.get(String(email));
  if (!stored) return res.status(401).json({ message: 'Google account not connected' });

  try {
    const auth = makeOAuth2(stored.tokens);
    const calendar = google.calendar({ version: 'v3', auth });
    
    // Default to a 30-day window if not provided
    const tMin = timeMin ? new Date(timeMin) : new Date();
    const tMax = timeMax ? new Date(timeMax) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: tMin.toISOString(),
      timeMax: tMax.toISOString(),
      maxResults: 50,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = (response.data.items || []).map(e => {
      const start = e.start.dateTime || e.start.date;
      const end = e.end.dateTime || e.end.date;
      const startDate = new Date(start);
      const endDate = new Date(end);
      
      // Calculate duration in hours/mins
      const diffMs = endDate - startDate;
      const diffHrs = Math.floor(diffMs / 3600000);
      const diffMins = Math.floor((diffMs % 3600000) / 60000);
      let durationStr = '';
      if (diffHrs > 0) durationStr += `${diffHrs}h`;
      if (diffMins > 0) durationStr += ` ${diffMins}m`;
      if (!durationStr) durationStr = 'All day';

      return {
        id: e.id,
        title: e.summary || '(No title)',
        date: start.split('T')[0],
        time: startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        duration: durationStr.trim(),
        type: e.hangoutLink ? 'call' : 'meeting',
        location: e.location || (e.hangoutLink ? 'Virtual' : ''),
        attendees: (e.attendees || []).length,
      };
    });

    res.json({ events });
  } catch (err) {
    console.error('Calendar fetch error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// POST /api/calendar/events
app.post('/api/calendar/events', async (req, res) => {
  const { email, title, date, time, duration } = req.body;
  if (!email) return res.status(400).json({ message: 'email param required' });
  const stored = gmailTokenStore.get(String(email));
  if (!stored) return res.status(401).json({ message: 'Google account not connected' });

  try {
    const auth = makeOAuth2(stored.tokens);
    const calendar = google.calendar({ version: 'v3', auth });

    // Very basic parsing for demo: assuming 'time' is "9:00 AM" and date is "YYYY-MM-DD"
    // In a real app we'd parse timezone strictly
    const startDateTime = new Date(`${date} ${time}`);
    
    // Parse duration (e.g. "1h", "30m")
    let addMs = 3600000; // default 1h
    if (duration) {
      if (duration.includes('h')) addMs = parseFloat(duration) * 3600000;
      else if (duration.includes('m')) addMs = parseFloat(duration) * 60000;
    }
    const endDateTime = new Date(startDateTime.getTime() + addMs);

    const event = {
      summary: title,
      start: {
        dateTime: startDateTime.toISOString(),
      },
      end: {
        dateTime: endDateTime.toISOString(),
      },
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
    });

    res.json({ success: true, eventId: response.data.id });
  } catch (err) {
    console.error('Calendar create error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// ══════════════════════════════════════════
// START SERVER
// ══════════════════════════════════════════

app.listen(PORT, () => {
  console.log(`\n🚀 Ama Backend running at http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
});

