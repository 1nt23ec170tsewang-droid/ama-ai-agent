require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const admin = require('firebase-admin');
const path = require('path');
const { google } = require('googleapis');
const crypto = require('crypto');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { rateLimit } = require('express-rate-limit');

// ──────────────────────────────────────────
// STRUCTURED LOGGER (JSON SIEM COMPLIANT)
// ──────────────────────────────────────────
const logStructured = (level, event, metadata = {}) => {
  const logMessage = {
    timestamp: new Date().toISOString(),
    level: level.toUpperCase(),
    event,
    ...metadata
  };
  console.log(JSON.stringify(logMessage));
};

// ──────────────────────────────────────────
// STRICT ENVIRONMENT GATING (FAIL-FAST)
// ──────────────────────────────────────────
if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'ama_fallback_secret' || process.env.JWT_SECRET === 'ama_chief_of_staff_secret_key') {
  logStructured('FATAL', 'STARTUP_ERROR', { reason: 'JWT_SECRET environment variable is missing, empty, or insecure.' });
  process.exit(1);
}
if (process.env.JWT_SECRET.length < 32) {
  logStructured('FATAL', 'STARTUP_ERROR', { reason: 'JWT_SECRET must be at least 32 characters (256 bits) long to prevent brute-forcing.' });
  process.exit(1);
}


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
// Trust proxy is required for Render/Cloudflare rate limiting
app.set('trust proxy', 1);

const PORT = process.env.PORT || 5000;
const SECRET_KEY = process.env.JWT_SECRET;
const REFRESH_SECRET_KEY = process.env.JWT_REFRESH_SECRET || (SECRET_KEY + '_refresh_rotation_key');

// ──────────────────────────────────────────
// SECURITY HEADERS & HTTPS GATING
// ──────────────────────────────────────────
app.use(helmet());

const enforceHttps = (req, res, next) => {
  if (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-proto'] !== 'https') {
    logStructured('WARN', 'HTTP_REDIRECT', { ip: req.ip, url: req.originalUrl });
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }
  next();
};
app.use(enforceHttps);

// ──────────────────────────────────────────
// DYNAMIC CORS CONFIGURATION
// ──────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'https://ama-frontend-8efz.onrender.com', // Explicitly added your Render URL
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174'
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logStructured('SECURITY', 'CORS_BLOCKED', { origin, ip: origin });
      callback(new Error('Blocked by CORS policy'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  optionsSuccessStatus: 200
}));

app.use(express.json());
app.use(cookieParser());

// ──────────────────────────────────────────
// SLIDING-WINDOW RATE LIMITERS
// ──────────────────────────────────────────
// 1. Global API Guard
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP, please try again after 15 minutes.' },
  handler: (req, res, next, options) => {
    logStructured('SECURITY', 'RATE_LIMIT_BLOCKED', { ip: req.ip, path: req.path, type: 'global' });
    res.status(429).json(options.message);
  }
});
app.use('/api/', globalLimiter);

// 2. Strict Auth Guard (Brute-Force & Bot account prevention)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login or registration attempts. Please try again after 15 minutes.' },
  handler: (req, res, next, options) => {
    logStructured('SECURITY', 'RATE_LIMIT_BLOCKED', { ip: req.ip, path: req.path, type: 'auth', email: req.body?.email });
    res.status(429).json(options.message);
  }
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// 3. AI & Cost Guard
const aiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many AI requests. Please space out your AI requests to prevent resource drain.' },
  handler: (req, res, next, options) => {
    logStructured('SECURITY', 'RATE_LIMIT_BLOCKED', { ip: req.ip, path: req.path, type: 'ai', userId: req.user?.id });
    res.status(429).json(options.message);
  }
});
app.use('/api/ama', aiLimiter);

// 4. Mailer Guard (Password Resets & Verifications)
const mailerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many verification or reset requests. Please wait 15 minutes before trying again.' },
  handler: (req, res, next, options) => {
    logStructured('SECURITY', 'RATE_LIMIT_BLOCKED', { ip: req.ip, path: req.path, type: 'mailer', email: req.body?.email });
    res.status(429).json(options.message);
  }
});
app.use('/api/auth/forgot-password', mailerLimiter);
app.use('/api/auth/reset-password', mailerLimiter);
app.use('/api/auth/resend-verification', mailerLimiter);

// In-memory fallback if Firestore is not configured
const inMemoryUsers = [];
const inMemoryRefreshTokens = []; // Track RTR tokens in-memory

// ──────────────────────────────────────────
// STRICT INPUT SANITIZATION (NoSQL Guard)
// ──────────────────────────────────────────
const sanitizeInput = (val) => {
  if (val === undefined || val === null) return '';
  return String(val).trim();
};

// ──────────────────────────────────────────
// JWT AUTHENTICATION MIDDLEWARES
// ──────────────────────────────────────────
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.split(' ')[1];
  
  if (!token && req.cookies) {
    token = req.cookies.token;
  }
  
  if (!token) return res.status(401).json({ message: 'Access Denied: No token provided.' });
  
  jwt.verify(token, SECRET_KEY, { algorithms: ['HS256'] }, (err, user) => {
    if (err) {
      logStructured('WARN', 'INVALID_ACCESS_TOKEN', { ip: req.ip, error: err.message });
      return res.status(403).json({ message: 'Invalid or Expired Token.' });
    }
    req.user = user;
    next();
  });
};

const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.split(' ')[1];
  
  if (!token && req.cookies) {
    token = req.cookies.token;
  }
  
  if (!token) {
    req.user = { id: 'guest', name: 'User', email: '', company: '', role: '' };
    return next();
  }
  
  jwt.verify(token, SECRET_KEY, { algorithms: ['HS256'] }, (err, user) => {
    req.user = err ? { id: 'guest', name: 'User', email: '', company: '', role: '' } : user;
    next();
  });
};

// ──────────────────────────────────────────
// ROLE-BASED ACCESS CONTROL (RBAC)
// ──────────────────────────────────────────
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Access Denied: Unauthenticated.' });
    if (!allowedRoles.includes(req.user.role)) {
      logStructured('SECURITY', 'UNAUTHORIZED_ROLE_ACCESS', { ip: req.ip, userId: req.user.id, role: req.user.role, allowedRoles });
      return res.status(403).json({ message: 'Access Denied: Insufficient permissions.' });
    }
    next();
  };
};

const requireAdmin = requireRole(['admin']);

// ──────────────────────────────────────────
// GLOBAL IDOR GATING MIDDLEWARE
// ──────────────────────────────────────────
const checkDocOwnership = (collectionName, userIdField = 'userId') => {
  return async (req, res, next) => {
    try {
      const docId = sanitizeInput(req.params.id);
      if (!docId) return res.status(400).json({ message: 'Resource ID is required.' });

      if (!db) {
        // Fallback for in-memory mode: let the route handlers verify array elements
        return next();
      }

      const doc = await db.collection(collectionName).doc(docId).get();
      if (!doc.exists) return res.status(404).json({ message: 'Resource not found.' });

      const data = doc.data();
      if (data[userIdField] !== req.user.id) {
        logStructured('SECURITY', 'IDOR_ATTEMPT_BLOCKED', { ip: req.ip, userId: req.user.id, docId, collection: collectionName });
        return res.status(403).json({ message: 'Access Denied: You do not own this resource.' });
      }

      req.resourceData = { id: doc.id, ...data };
      next();
    } catch (err) {
      next(err);
    }
  };
};

// ──────────────────────────────────────────
// EMAIL OWNERSHIP GATING FOR EXTERNAL APIS (GMAIL/CALENDAR)
// ──────────────────────────────────────────
const requireEmailOwnership = (req, res, next) => {
  const email = req.query.email || req.body.email;
  if (!email) {
    return res.status(400).json({ message: 'Email parameter is required.' });
  }
  if (String(email).toLowerCase() !== req.user.email.toLowerCase()) {
    logStructured('SECURITY', 'UNAUTHORIZED_EMAIL_ACCESS_ATTEMPT', {
      ip: req.ip,
      userId: req.user.id,
      requestedEmail: email,
      userEmail: req.user.email
    });
    return res.status(403).json({ message: 'Access Denied: You do not own this connected email account.' });
  }
  next();
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

// Port listener
app.listen(PORT, () => {
  console.log(`🚀 Ama Backend running at http://localhost:${PORT}`);
});