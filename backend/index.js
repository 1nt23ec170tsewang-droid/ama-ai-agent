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
const { Resend } = require('resend');

// ──────────────────────────────────────────
// RESEND EMAIL CLIENT
// ──────────────────────────────────────────
const resend = new Resend(process.env.RESEND_API_KEY);

const sendVerificationEmail = async (email, code) => {
  const { data, error } = await resend.emails.send({
    from: 'onboarding@resend.dev',
    to: email,
    subject: 'Verification Code for AMA AI',
    html: `<strong>Your 6-digit verification code is: ${code}</strong>`
  });

  if (error) {
    console.error('❌ Failed to send email via Resend:', error);
    throw new Error(error.message || 'Resend API error');
  }

  console.log('✅ Email sent successfully to:', email, '| ID:', data?.id);
};

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
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://ama-frontend-8efz.onrender.com'
].filter(Boolean);

const isOriginAllowed = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  // Dynamically support any Render deployment / preview subdomains safely
  if (origin.endsWith('.onrender.com')) return true;
  return false;
};

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      logStructured('SECURITY', 'CORS_BLOCKED', { origin, ip: origin });
      callback(null, false); // Safe standard CORS preflight rejection
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Cookie'],
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

// ══════════════════════════════════════════
// AUTH ROUTES
// ══════════════════════════════════════════

// Helper: Password Complexity Validator
const validatePassword = (pwd) => {
  if (pwd.length < 8) return 'Password must be at least 8 characters long.';
  if (!/[A-Z]/.test(pwd)) return 'Password must contain at least one uppercase letter.';
  if (!/[a-z]/.test(pwd)) return 'Password must contain at least one lowercase letter.';
  if (!/[0-9]/.test(pwd)) return 'Password must contain at least one number.';
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) return 'Password must contain at least one special character.';
  return null;
};

// ──────────────────────────────────────────
// AUTH ENDPOINTS
// ──────────────────────────────────────────

app.post('/api/auth/register', async (req, res, next) => {
  try {
    const name = sanitizeInput(req.body.name);
    const email = sanitizeInput(req.body.email).toLowerCase();
    const password = sanitizeInput(req.body.password);
    const company = sanitizeInput(req.body.company);
    const role = sanitizeInput(req.body.role || 'user'); // Default to standard user

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required.' });
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ message: passwordError });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Generate 6-digit email verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const emailVerificationCodeExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

    const userData = { 
      id: Date.now().toString(), 
      name, 
      email, 
      company, 
      role, 
      isEmailVerified: false,
      emailVerificationCode: verificationCode,
      emailVerificationCodeExpires,
      createdAt: new Date().toISOString() 
    };

    if (db) {
      const existing = await db.collection('users').where('email', '==', email).get();
      if (!existing.empty) return res.status(400).json({ message: 'User already exists.' });

      await db.collection('users').doc(userData.id).set({ ...userData, password: hashedPassword });
    } else {
      if (inMemoryUsers.find(u => u.email === email)) {
        return res.status(400).json({ message: 'User already exists.' });
      }
      inMemoryUsers.push({ ...userData, password: hashedPassword });
    }

    logStructured('INFO', 'USER_REGISTERED', { userId: userData.id, email, role });

    // Send transactional verification email via Resend (with fail-safe fallback)
    try {
      await sendVerificationEmail(email, verificationCode);
      logStructured('INFO', 'EMAIL_VERIFICATION_SENT_SUCCESS', { email });
    } catch (emailErr) {
      console.error('❌ Failed to send verification email via Resend:', emailErr.message);
      console.log('📋 FALLBACK — NEW VERIFICATION CODE:', verificationCode);
    }

    res.status(201).json({ 
      message: 'Registration successful. A 6-digit verification code has been sent to your email.',
      email
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const email = sanitizeInput(req.body.email).toLowerCase();
    const password = sanitizeInput(req.body.password);

    if (!email || !password) return res.status(400).json({ message: 'Email and password required.' });

    let foundUser = null;
    if (db) {
      const snap = await db.collection('users').where('email', '==', email).get();
      if (!snap.empty) foundUser = { id: snap.docs[0].id, ...snap.docs[0].data() };
    } else {
      foundUser = inMemoryUsers.find(u => u.email === email);
    }

    if (!foundUser) {
      logStructured('WARN', 'LOGIN_FAILED_USER_NOT_FOUND', { ip: req.ip, email });
      return res.status(400).json({ message: 'Incorrect email or password.' });
    }

    const isMatch = await bcrypt.compare(password, foundUser.password);
    if (!isMatch) {
      logStructured('WARN', 'LOGIN_FAILED_WRONG_PASSWORD', { ip: req.ip, email, userId: foundUser.id });
      return res.status(400).json({ message: 'Incorrect email or password.' });
    }

    // Intercept if email is unverified
    if (!foundUser.isEmailVerified) {
      logStructured('SECURITY', 'LOGIN_BLOCKED_EMAIL_UNVERIFIED', { ip: req.ip, email, userId: foundUser.id });
      return res.status(403).json({ 
        message: 'Your email address is not verified. Please verify your email first.',
        unverified: true,
        email
      });
    }

    // Update last login
    if (db) {
      await db.collection('users').doc(foundUser.id).update({ lastLogin: new Date().toISOString() });
    } else {
      foundUser.lastLogin = new Date().toISOString();
    }

    // Generate JWT access & refresh tokens (RTR)
    const accessToken = jwt.sign(
      { id: foundUser.id, email: foundUser.email, name: foundUser.name, company: foundUser.company, role: foundUser.role },
      SECRET_KEY,
      { expiresIn: '15m', algorithm: 'HS256' }
    );

    const refreshToken = jwt.sign(
      { id: foundUser.id, email: foundUser.email },
      REFRESH_SECRET_KEY,
      { expiresIn: '7d', algorithm: 'HS256' }
    );

    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    if (db) {
      await db.collection('refresh_tokens').doc(refreshTokenHash).set({
        userId: foundUser.id,
        expiresAt,
        rotated: false,
        createdAt: new Date().toISOString()
      });
    } else {
      inMemoryRefreshTokens.push({
        tokenHash: refreshTokenHash,
        userId: foundUser.id,
        expiresAt,
        rotated: false
      });
    }

    // Set refresh token in HttpOnly Cookie (path protected to refresh)
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      path: '/api/auth/refresh',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    logStructured('INFO', 'LOGIN_SUCCESS', { userId: foundUser.id, email: foundUser.email });

    res.status(200).json({
      message: 'Login successful',
      token: accessToken,
      user: { id: foundUser.id, name: foundUser.name, email: foundUser.email, company: foundUser.company, role: foundUser.role }
    });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────
// EMAIL VERIFICATION ROUTES
// ──────────────────────────────────────────

app.post('/api/auth/verify-email', async (req, res, next) => {
  try {
    const email = sanitizeInput(req.body.email).toLowerCase();
    const code = sanitizeInput(req.body.code);

    if (!email || !code) return res.status(400).json({ message: 'Email and 6-digit code are required.' });

    let foundUser = null;
    if (db) {
      const snap = await db.collection('users').where('email', '==', email).get();
      if (!snap.empty) foundUser = { id: snap.docs[0].id, ...snap.docs[0].data() };
    } else {
      foundUser = inMemoryUsers.find(u => u.email === email);
    }

    if (!foundUser) return res.status(404).json({ message: 'User not found.' });

    if (foundUser.isEmailVerified) return res.status(400).json({ message: 'Email is already verified.' });

    // Validate verification code
    if (foundUser.emailVerificationCode !== code) {
      logStructured('WARN', 'EMAIL_VERIFICATION_FAILED_WRONG_CODE', { ip: req.ip, email, code });
      return res.status(400).json({ message: 'Incorrect verification code.' });
    }

    const now = new Date().toISOString();
    if (foundUser.emailVerificationCodeExpires < now) {
      logStructured('WARN', 'EMAIL_VERIFICATION_FAILED_EXPIRED_CODE', { ip: req.ip, email });
      return res.status(400).json({ message: 'Verification code has expired. Please request a new one.' });
    }

    // Mark as verified, wipe token
    const updates = {
      isEmailVerified: true,
      emailVerificationCode: null,
      emailVerificationCodeExpires: null
    };

    if (db) {
      await db.collection('users').doc(foundUser.id).update(updates);
    } else {
      Object.assign(foundUser, updates);
    }

    logStructured('SECURITY', 'EMAIL_VERIFIED_SUCCESS', { userId: foundUser.id, email });

    // Automatically log user in upon successful email verification
    const accessToken = jwt.sign(
      { id: foundUser.id, email: foundUser.email, name: foundUser.name, company: foundUser.company, role: foundUser.role },
      SECRET_KEY,
      { expiresIn: '15m', algorithm: 'HS256' }
    );

    const refreshToken = jwt.sign(
      { id: foundUser.id, email: foundUser.email },
      REFRESH_SECRET_KEY,
      { expiresIn: '7d', algorithm: 'HS256' }
    );

    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    if (db) {
      await db.collection('refresh_tokens').doc(refreshTokenHash).set({
        userId: foundUser.id,
        expiresAt,
        rotated: false,
        createdAt: new Date().toISOString()
      });
    } else {
      inMemoryRefreshTokens.push({
        tokenHash: refreshTokenHash,
        userId: foundUser.id,
        expiresAt,
        rotated: false
      });
    }

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      path: '/api/auth/refresh',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.status(200).json({
      message: 'Email successfully verified. You are now logged in.',
      token: accessToken,
      user: { id: foundUser.id, name: foundUser.name, email: foundUser.email, company: foundUser.company, role: foundUser.role }
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/resend-verification', async (req, res, next) => {
  try {
    const email = sanitizeInput(req.body.email).toLowerCase();
    if (!email) return res.status(400).json({ message: 'Email is required.' });

    let foundUser = null;
    if (db) {
      const snap = await db.collection('users').where('email', '==', email).get();
      if (!snap.empty) foundUser = { id: snap.docs[0].id, ...snap.docs[0].data() };
    } else {
      foundUser = inMemoryUsers.find(u => u.email === email);
    }

    if (!foundUser) return res.status(404).json({ message: 'User not found.' });
    if (foundUser.isEmailVerified) return res.status(400).json({ message: 'Email is already verified.' });

    // Generate new code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationCodeExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const updates = {
      emailVerificationCode: verificationCode,
      emailVerificationCodeExpires: verificationCodeExpires
    };

    if (db) {
      await db.collection('users').doc(foundUser.id).update(updates);
    } else {
      Object.assign(foundUser, updates);
    }

    // Send email via Resend — surface a real error if it fails so the client knows
    try {
      await sendVerificationEmail(email, verificationCode);
      logStructured('INFO', 'EMAIL_VERIFICATION_RESENT_SUCCESS', { email });
    } catch (emailErr) {
      console.error('❌ Resend failed in /resend-verification:', emailErr.message);
      console.log('📋 FALLBACK — VERIFICATION CODE FOR', email, ':', verificationCode);
      return res.status(500).json({ message: 'Failed to send verification email. Please try again.' });
    }

    res.status(200).json({ message: 'A new 6-digit verification code has been sent to your email.' });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────
// JWT SILENT REFRESH (RTR & REPLAY PROTECTION)
// ──────────────────────────────────────────

app.post('/api/auth/refresh', async (req, res, next) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) return res.status(401).json({ message: 'Refresh token missing.' });

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, REFRESH_SECRET_KEY, { algorithms: ['HS256'] });
    } catch (err) {
      logStructured('WARN', 'INVALID_REFRESH_TOKEN', { ip: req.ip, error: err.message });
      return res.status(401).json({ message: 'Invalid refresh token.' });
    }

    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    let storedToken = null;
    if (db) {
      const snap = await db.collection('refresh_tokens').doc(tokenHash).get();
      if (snap.exists) storedToken = snap.data();
    } else {
      storedToken = inMemoryRefreshTokens.find(t => t.tokenHash === tokenHash);
    }

    if (!storedToken) {
      logStructured('WARN', 'UNKNOWN_REFRESH_TOKEN', { ip: req.ip, tokenHash });
      return res.status(401).json({ message: 'Session not found.' });
    }

    // Replay / Token Reuse Detection
    if (storedToken.rotated) {
      logStructured('SECURITY', 'JWT_REPLAY_ATTACK_DETECTED', { ip: req.ip, userId: decoded.id, tokenHash });

      // Attack detected! Immediately revoke ALL refresh tokens for this user
      if (db) {
        const snap = await db.collection('refresh_tokens').where('userId', '==', decoded.id).get();
        const batch = db.batch();
        snap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
      } else {
        for (let i = inMemoryRefreshTokens.length - 1; i >= 0; i--) {
          if (inMemoryRefreshTokens[i].userId === decoded.id) {
            inMemoryRefreshTokens.splice(i, 1);
          }
        }
      }

      res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
      return res.status(400).json({ message: 'Security alert: Session replayed. For safety, you must log in again.' });
    }

    // Mark current token as rotated
    if (db) {
      await db.collection('refresh_tokens').doc(tokenHash).update({ rotated: true });
    } else {
      storedToken.rotated = true;
    }

    // Fetch fresh user details
    let foundUser = null;
    if (db) {
      const snap = await db.collection('users').doc(decoded.id).get();
      if (snap.exists) foundUser = { id: snap.id, ...snap.data() };
    } else {
      foundUser = inMemoryUsers.find(u => u.id === decoded.id);
    }

    if (!foundUser) return res.status(401).json({ message: 'User no longer exists.' });

    // Generate new Access & Rotated Refresh pair
    const accessToken = jwt.sign(
      { id: foundUser.id, email: foundUser.email, name: foundUser.name, company: foundUser.company, role: foundUser.role },
      SECRET_KEY,
      { expiresIn: '15m', algorithm: 'HS256' }
    );

    const newRefreshToken = jwt.sign(
      { id: foundUser.id, email: foundUser.email },
      REFRESH_SECRET_KEY,
      { expiresIn: '7d', algorithm: 'HS256' }
    );

    const newHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    if (db) {
      await db.collection('refresh_tokens').doc(newHash).set({
        userId: foundUser.id,
        expiresAt,
        rotated: false,
        createdAt: new Date().toISOString()
      });
    } else {
      inMemoryRefreshTokens.push({
        tokenHash: newHash,
        userId: foundUser.id,
        expiresAt,
        rotated: false
      });
    }

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      path: '/api/auth/refresh',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    logStructured('INFO', 'SESSION_REFRESHED', { userId: foundUser.id });

    res.status(200).json({
      token: accessToken,
      user: { id: foundUser.id, name: foundUser.name, email: foundUser.email, company: foundUser.company, role: foundUser.role }
    });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────
// AUTH LOGOUT (REVOCATION)
// ──────────────────────────────────────────

app.post('/api/auth/logout', async (req, res, next) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (refreshToken) {
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      if (db) {
        await db.collection('refresh_tokens').doc(tokenHash).delete();
      } else {
        const idx = inMemoryRefreshTokens.findIndex(t => t.tokenHash === tokenHash);
        if (idx !== -1) inMemoryRefreshTokens.splice(idx, 1);
      }
      logStructured('INFO', 'SESSION_REVOKED_LOGOUT', { tokenHash });
    }

    res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
    res.status(200).json({ message: 'Logout successful.' });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────
// CRYPTOGRAPHICALLY SECURE PASSWORD RESET ROUTES
// ──────────────────────────────────────────

app.post('/api/auth/forgot-password', async (req, res, next) => {
  try {
    const email = sanitizeInput(req.body.email).toLowerCase();
    if (!email) return res.status(400).json({ message: 'Email address is required.' });

    let foundUser = null;
    if (db) {
      const snap = await db.collection('users').where('email', '==', email).get();
      if (!snap.empty) foundUser = { id: snap.docs[0].id, ...snap.docs[0].data() };
    } else {
      foundUser = inMemoryUsers.find(u => u.email === email);
    }

    // Always respond with a generic success message to prevent user enumeration attacks!
    const genericResponse = { message: 'If an account exists with this email, a secure reset link has been sent.' };

    if (!foundUser) {
      logStructured('INFO', 'FORGOT_PASSWORD_REQUESTED_UNKNOWN_USER', { email });
      return res.status(200).json(genericResponse);
    }

    // Generate secure CSPRNG 256-bit reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const resetExpires = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // Strict 15 minutes

    const updates = {
      resetPasswordTokenHash: resetTokenHash,
      resetPasswordTokenExpires: resetExpires
    };

    if (db) {
      await db.collection('users').doc(foundUser.id).update(updates);
    } else {
      Object.assign(foundUser, updates);
    }

    logStructured('SECURITY', 'PASSWORD_RESET_TOKEN_CREATED', { userId: foundUser.id, email });
    // Log secure reset link (Transactional mock)
    logStructured('SECURITY', 'PASSWORD_RESET_LINK_SENT', {
      email,
      link: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`
    });

    res.status(200).json(genericResponse);
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/reset-password', async (req, res, next) => {
  try {
    const email = sanitizeInput(req.body.email).toLowerCase();
    const token = sanitizeInput(req.body.token);
    const newPassword = sanitizeInput(req.body.newPassword);

    if (!email || !token || !newPassword) {
      return res.status(400).json({ message: 'Email, token, and new password are required.' });
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) return res.status(400).json({ message: passwordError });

    let foundUser = null;
    if (db) {
      const snap = await db.collection('users').where('email', '==', email).get();
      if (!snap.empty) foundUser = { id: snap.docs[0].id, ...snap.docs[0].data() };
    } else {
      foundUser = inMemoryUsers.find(u => u.email === email);
    }

    if (!foundUser || !foundUser.resetPasswordTokenHash) {
      logStructured('WARN', 'PASSWORD_RESET_ATTEMPT_INVALID_USER', { email });
      return res.status(400).json({ message: 'Invalid reset attempt or expired token.' });
    }

    // Validate SHA-256 token hash
    const inputHash = crypto.createHash('sha256').update(token).digest('hex');
    if (foundUser.resetPasswordTokenHash !== inputHash) {
      logStructured('WARN', 'PASSWORD_RESET_ATTEMPT_WRONG_TOKEN', { userId: foundUser.id, email });
      return res.status(400).json({ message: 'Invalid reset attempt or expired token.' });
    }

    const now = new Date().toISOString();
    if (foundUser.resetPasswordTokenExpires < now) {
      logStructured('WARN', 'PASSWORD_RESET_ATTEMPT_EXPIRED_TOKEN', { userId: foundUser.id, email });
      return res.status(400).json({ message: 'Invalid reset attempt or expired token.' });
    }

    // Strict validation succeeded: hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const updates = {
      password: hashedPassword,
      resetPasswordTokenHash: null,
      resetPasswordTokenExpires: null
    };

    if (db) {
      await db.collection('users').doc(foundUser.id).update(updates);
      
      // Global Revocation: Delete all active refresh sessions for safety
      const tokensSnap = await db.collection('refresh_tokens').where('userId', '==', foundUser.id).get();
      const batch = db.batch();
      tokensSnap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    } else {
      Object.assign(foundUser, updates);
      // In-memory revocation
      for (let i = inMemoryRefreshTokens.length - 1; i >= 0; i--) {
        if (inMemoryRefreshTokens[i].userId === foundUser.id) {
          inMemoryRefreshTokens.splice(i, 1);
        }
      }
    }

    logStructured('SECURITY', 'PASSWORD_RESET_SUCCESS', { userId: foundUser.id, email });
    res.status(200).json({ message: 'Password reset successful. All other active sessions have been signed out. Please log in.' });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────
// ROLE-GATED ADMINISTRATIVE ROUTES
// ──────────────────────────────────────────

app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    let allUsers = [];
    if (db) {
      const snap = await db.collection('users').get();
      allUsers = snap.docs.map(doc => {
        const { password, emailVerificationCode, emailVerificationCodeExpires, resetPasswordTokenHash, resetPasswordTokenExpires, ...safeUser } = doc.data();
        return safeUser;
      });
    } else {
      allUsers = inMemoryUsers.map(({ password, emailVerificationCode, emailVerificationCodeExpires, resetPasswordTokenHash, resetPasswordTokenExpires, ...safeUser }) => safeUser);
    }

    logStructured('SECURITY', 'ADMIN_FETCHED_USERS', { adminId: req.user.id });
    res.json({ users: allUsers });
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/system-status', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const status = {
      environment: process.env.NODE_ENV || 'development',
      database: db ? 'connected (Firestore)' : 'active (In-Memory Fallback)',
      rateLimiters: 'configured & enforcing',
      activeSessions: db ? 'persisted' : inMemoryRefreshTokens.length,
      timestamp: new Date().toISOString()
    };
    
    logStructured('SECURITY', 'ADMIN_FETCHED_SYSTEM_STATUS', { adminId: req.user.id });
    res.json(status);
  } catch (error) {
    next(error);
  }
});


app.get('/api/auth/me', authenticateToken, async (req, res, next) => {
  try {
    let userProfile = req.user;
    if (db) {
      const snap = await db.collection('users').doc(req.user.id).get();
      if (snap.exists) userProfile = { id: snap.id, ...snap.data() };
    } else {
      const uMatch = inMemoryUsers.find(u => u.id === req.user.id);
      if (uMatch) userProfile = uMatch;
    }
    const { password, emailVerificationCode, emailVerificationCodeExpires, resetPasswordTokenHash, resetPasswordTokenExpires, ...safeProfile } = userProfile;
    res.json({ user: safeProfile });
  } catch (error) {
    next(error);
  }
});

app.put('/api/auth/profile', authenticateToken, async (req, res, next) => {
  try {
    const name = sanitizeInput(req.body.name);
    const company = sanitizeInput(req.body.company);
    const role = sanitizeInput(req.body.role); // Standard profile edit should only update allowed fields

    if (!name) return res.status(400).json({ message: 'Name is required.' });

    const updates = { name, company, updatedAt: new Date().toISOString() };
    if (db) {
      await db.collection('users').doc(req.user.id).update(updates);
    } else {
      const found = inMemoryUsers.find(u => u.id === req.user.id);
      if (found) Object.assign(found, updates);
    }

    logStructured('INFO', 'PROFILE_UPDATED', { userId: req.user.id });
    res.json({ message: 'Profile updated successfully', user: { ...req.user, ...updates } });
  } catch (error) {
    next(error);
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

// ──────────────────────────────────────────
// AMA CHAT — SSE STREAMING  (/api/ama/chat/stream)
// ──────────────────────────────────────────
app.post('/api/ama/chat/stream', optionalAuth, async (req, res) => {
  const { messages, userContext, systemPrompt: clientSystemPrompt } = req.body;
  const user = req.user;

  if (!messages || !messages.length) {
    return res.status(400).json({ message: 'Messages are required.' });
  }

  // SSE headers — keep connection alive for streaming
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable Nginx buffering on Render
  res.flushHeaders();

  const sendChunk = (text) => {
    res.write(`data: ${JSON.stringify({ delta: text })}\n\n`);
  };
  const sendDone = () => {
    res.write(`data: [DONE]\n\n`);
    res.end();
  };
  const sendError = (msg) => {
    res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
    res.end();
  };

  // Build system context (client-provided or default)
  const ctx = {
    name: userContext?.name || user?.name || 'User',
    company: userContext?.company || user?.company || '',
  };
  let systemContext = clientSystemPrompt ||
    `You are Ama, a world-class AI Chief of Staff for ${ctx.name}${ctx.company ? ` at ${ctx.company}` : ''}. You are concise, highly accurate, and professional. Use structured Markdown, avoid fluff, and prioritize being helpful above all else.`;

  systemContext += `\n\nIMPORTANT SCHEDULING RULES:\n- When a user asks to schedule a meeting or create a task, immediately output the EXACT JSON block without asking clarifying questions.\n- Use reasonable defaults if information is missing.`;

  let fullReply = '';

  try {
    if (OPENROUTER_API_KEY) {
      // ── OpenRouter streaming ─────────────────────────────
      const openAIMessages = messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      }));

      const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:5173',
          'X-Title': 'Ama AI Chief of Staff',
        },
        body: JSON.stringify({
          model: OPENROUTER_MODEL,
          stream: true,
          messages: [
            { role: 'system', content: systemContext },
            ...openAIMessages,
          ],
          max_tokens: 2048,
        }),
      });

      if (!orRes.ok) {
        const errText = await orRes.text();
        throw new Error(`OpenRouter stream error ${orRes.status}: ${errText}`);
      }

      // Parse the SSE stream from OpenRouter and pipe chunks to client
      const decoder = new TextDecoder();
      let buffer = '';
      for await (const rawChunk of orRes.body) {
        buffer += decoder.decode(rawChunk, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete line in buffer
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (!trimmed.startsWith('data:')) continue;
          const jsonStr = trimmed.slice(5).trim();
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              fullReply += delta;
              sendChunk(delta);
            }
          } catch (_) {
            // skip malformed chunk
          }
        }
      }
    } else {
      // ── Gemini fallback (non-streaming, emit single chunk) ──
      const conversationHistory = messages
        .map(m => `${m.role === 'user' ? 'User' : 'Ama'}: ${m.content}`)
        .join('\n');
      const fullPrompt = `${systemContext}\n\nConversation:\n${conversationHistory}\n\nAma:`;
      fullReply = await askGemini(fullPrompt);
      sendChunk(fullReply);
    }

    sendDone();

    // Save assembled reply to Firestore (non-blocking)
    if (db && fullReply) {
      const sessionId = req.body.sessionId || Date.now().toString();
      db.collection('conversations').add({
        userId: user?.id || 'anonymous',
        sessionId,
        userMessage: messages[messages.length - 1]?.content,
        amaResponse: fullReply,
        timestamp: new Date().toISOString(),
      }).catch(err => console.error('Firestore save error:', err));
    }
  } catch (err) {
    console.error('SSE stream error:', err.message);
    sendError('Failed to stream AI response. Please try again.');
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

app.put('/api/tasks/:id', authenticateToken, checkDocOwnership('tasks'), async (req, res, next) => {
  try {
    if (db) await db.collection('tasks').doc(req.params.id).update({ ...req.body, updatedAt: new Date().toISOString() });
    res.json({ id: req.params.id, ...req.body });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/tasks/:id', authenticateToken, checkDocOwnership('tasks'), async (req, res, next) => {
  try {
    if (db) await db.collection('tasks').doc(req.params.id).delete();
    res.json({ message: 'Task deleted successfully.' });
  } catch (error) {
    next(error);
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

app.put('/api/events/:id', authenticateToken, checkDocOwnership('events'), async (req, res, next) => {
  try {
    if (db) await db.collection('events').doc(req.params.id).update({ ...req.body, updatedAt: new Date().toISOString() });
    res.json({ id: req.params.id, ...req.body });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/events/:id', authenticateToken, checkDocOwnership('events'), async (req, res, next) => {
  try {
    if (db) await db.collection('events').doc(req.params.id).delete();
    res.json({ message: 'Event deleted successfully.' });
  } catch (error) {
    next(error);
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

app.put('/api/metrics/:id', authenticateToken, checkDocOwnership('metrics'), async (req, res, next) => {
  try {
    if (db) await db.collection('metrics').doc(req.params.id).update({ ...req.body, updatedAt: new Date().toISOString() });
    res.json({ id: req.params.id, ...req.body });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/metrics/:id', authenticateToken, checkDocOwnership('metrics'), async (req, res, next) => {
  try {
    if (db) await db.collection('metrics').doc(req.params.id).delete();
    res.json({ message: 'Metric deleted successfully.' });
  } catch (error) {
    next(error);
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

app.put('/api/team/:id', authenticateToken, checkDocOwnership('team', 'ownerId'), async (req, res, next) => {
  try {
    if (db) await db.collection('team').doc(req.params.id).update({ ...req.body, updatedAt: new Date().toISOString() });
    res.json({ id: req.params.id, ...req.body });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/team/:id', authenticateToken, checkDocOwnership('team', 'ownerId'), async (req, res, next) => {
  try {
    if (db) await db.collection('team').doc(req.params.id).delete();
    res.json({ message: 'Team member removed.' });
  } catch (error) {
    next(error);
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
app.get('/api/gmail/auth', authenticateToken, (req, res, next) => {
  try {
    const login_hint = req.user.email;
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
    next(err);
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
app.get('/api/gmail/status', authenticateToken, requireEmailOwnership, (req, res) => {
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
app.get('/api/gmail/messages', authenticateToken, requireEmailOwnership, async (req, res, next) => {
  const { email, maxResults = 20 } = req.query;
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
    next(err);
  }
});

// POST /api/gmail/archive  { email, messageId }
app.post('/api/gmail/archive', authenticateToken, requireEmailOwnership, async (req, res, next) => {
  const { email, messageId } = req.body;
  const stored = gmailTokenStore.get(email);
  if (!stored) return res.status(401).json({ message: 'Gmail not connected' });
  try {
    const auth = makeOAuth2(stored.tokens);
    await google.gmail({ version: 'v1', auth }).users.messages.modify({ userId: 'me', id: messageId, requestBody: { removeLabelIds: ['INBOX'] } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /api/gmail/read  { email, messageId }
app.post('/api/gmail/read', authenticateToken, requireEmailOwnership, async (req, res, next) => {
  const { email, messageId } = req.body;
  const stored = gmailTokenStore.get(email);
  if (!stored) return res.status(401).json({ message: 'Gmail not connected' });
  try {
    const auth = makeOAuth2(stored.tokens);
    await google.gmail({ version: 'v1', auth }).users.messages.modify({ userId: 'me', id: messageId, requestBody: { removeLabelIds: ['UNREAD'] } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /api/gmail/send  { email, to, subject, body, threadId }
app.post('/api/gmail/send', authenticateToken, requireEmailOwnership, async (req, res, next) => {
  const { email, to, subject, body, threadId } = req.body;
  const stored = gmailTokenStore.get(email);
  if (!stored) return res.status(401).json({ message: 'Gmail not connected' });
  try {
    const auth = makeOAuth2(stored.tokens);
    const raw  = Buffer.from(`To: ${to}\r\nSubject: Re: ${subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}`).toString('base64url');
    await google.gmail({ version: 'v1', auth }).users.messages.send({ userId: 'me', requestBody: { raw, ...(threadId ? { threadId } : {}) } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ══════════════════════════════════════════
// GOOGLE CALENDAR ROUTES
// ══════════════════════════════════════════

// GET /api/calendar/events?email=...
app.get('/api/calendar/events', authenticateToken, requireEmailOwnership, async (req, res, next) => {
  const { email, timeMin, timeMax } = req.query;
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
    next(err);
  }
});

// POST /api/calendar/events
app.post('/api/calendar/events', authenticateToken, requireEmailOwnership, async (req, res, next) => {
  const { email, title, date, time, duration } = req.body;
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
    next(err);
  }
});

// ──────────────────────────────────────────
// CENTRALIZED SANITIZED ERROR MIDDLEWARE
// ──────────────────────────────────────────
app.use((err, req, res, next) => {
  // Log full error details securely on the server-side only
  logStructured('ERROR', 'API_INTERNAL_ERROR', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    message: err.message,
    stack: err.stack
  });

  const statusCode = err.status || err.statusCode || 500;
  
  res.status(statusCode).json({
    message: statusCode === 500 ? 'An unexpected error occurred. Please try again later.' : err.message,
    status: 'error'
  });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Ama Backend running at http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
});

