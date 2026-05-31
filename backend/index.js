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
const nodemailer = require('nodemailer');

// ──────────────────────────────────────────
// RESEND EMAIL CLIENT
// ──────────────────────────────────────────
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const sendVerificationEmail = async (email, code) => {
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });
      await transporter.sendMail({
        from: `"Ryve" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Verify your Ryve account',
        html: `<strong>Your 6-digit verification code is: ${code}</strong>`
      });
      console.log('✅ Verification email sent via Nodemailer to:', email);
      return;
    } catch (nodemailerErr) {
      console.error('❌ Nodemailer failed to send email:', nodemailerErr);
    }
  }

  if (!resend) {
    console.warn('⚠️ Resend API key not configured — skipping verification email');
    return;
  }
  const { data, error } = await resend.emails.send({
    from: 'Ryve <onboarding@resend.dev>',
    to: email,
    subject: 'Verify your Ryve account',
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
const OPENROUTER_MODEL   = 'openai/gpt-4o-mini';  // ChatGPT 4o Mini via OpenRouter

if (OPENROUTER_API_KEY) {
  console.log('✅ OpenRouter AI configured (gpt-4o-mini) — primary AI provider');
} else {
  console.warn('⚠️  OPENROUTER_API_KEY not set — will fall back to Gemini');
}

/** Call OpenRouter (ChatGPT 4.1) with a plain text prompt */
async function askOpenRouter(prompt, systemPrompt = 'You are Ryve, an AI Chief of Staff.') {
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
async function askOpenRouterMessages(messages, systemPrompt = 'You are Ryve, an AI Chief of Staff.') {
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
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.split(' ')[1];
  
  if (!token && req.cookies) {
    token = req.cookies.token;
  }
  
  if (!token) return res.status(401).json({ message: 'Access Denied: No token provided.' });
  
  if (admin && admin.apps.length > 0) {
    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      req.user = {
        id: decodedToken.uid,
        uid: decodedToken.uid,
        email: decodedToken.email,
        name: decodedToken.name || decodedToken.email || 'User',
        role: decodedToken.role || 'user'
      };
      return next();
    } catch (firebaseErr) {
      logStructured('INFO', 'FIREBASE_VERIFICATION_FALLBACK', { error: firebaseErr.message });
    }
  }

  jwt.verify(token, SECRET_KEY, { algorithms: ['HS256'] }, (err, user) => {
    if (err) {
      logStructured('WARN', 'INVALID_ACCESS_TOKEN', { ip: req.ip, error: err.message });
      return res.status(403).json({ message: 'Invalid or Expired Token.' });
    }
    req.user = user;
    next();
  });
};

const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.split(' ')[1];
  
  if (!token && req.cookies) {
    token = req.cookies.token;
  }
  
  if (!token) {
    req.user = { id: 'guest', name: 'User', email: '', company: '', role: '' };
    return next();
  }
  
  if (admin && admin.apps.length > 0) {
    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      req.user = {
        id: decodedToken.uid,
        uid: decodedToken.uid,
        email: decodedToken.email,
        name: decodedToken.name || decodedToken.email || 'User',
        role: decodedToken.role || 'user'
      };
      return next();
    } catch (firebaseErr) {
      // fallback
    }
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
const requireEmailOwnership = async (req, res, next) => {
  const email = req.query.email || req.body.email;
  if (!email) {
    return res.status(400).json({ message: 'Email parameter is required.' });
  }
  
  if (String(email).toLowerCase() === req.user.email.toLowerCase()) {
    return next();
  }

  // Also check if this email is the connected Gmail email for this user
  try {
    if (db) {
      const userDoc = await db.collection('users').doc(req.user.id).get();
      if (userDoc.exists) {
        const gmail = userDoc.data().gmail;
        if (gmail && String(email).toLowerCase() === String(gmail.connectedEmail).toLowerCase()) {
          return next();
        }
      }
    } else {
      const foundUser = inMemoryUsers.find(u => u.id === req.user.id);
      if (foundUser && foundUser.gmail && String(email).toLowerCase() === String(foundUser.gmail.connectedEmail).toLowerCase()) {
        return next();
      }
    }
  } catch (err) {
    console.error('Failed to verify connected email in requireEmailOwnership:', err.message);
  }

  logStructured('SECURITY', 'UNAUTHORIZED_EMAIL_ACCESS_ATTEMPT', {
    ip: req.ip,
    userId: req.user.id,
    requestedEmail: email,
    userEmail: req.user.email
  });
  return res.status(403).json({ message: 'Access Denied: You do not own this connected email account.' });
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
app.get('/', (req, res) => {
  res.json({
    message: '🚀 Ryve AI Chief of Staff API Server is running.',
    healthCheck: '/health',
    status: 'online'
  });
});

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
      isEmailVerified: email.startsWith('social.') ? true : false,
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

    // Send transactional verification email (with fail-safe fallback)
    try {
      await sendVerificationEmail(email, verificationCode);
      logStructured('INFO', 'EMAIL_VERIFICATION_SENT_SUCCESS', { email });
    } catch (emailErr) {
      console.error('❌ Failed to send verification email:', emailErr.message);
      console.log('📋 FALLBACK — NEW VERIFICATION CODE:', verificationCode);
    }

    // Generate JWT access & refresh tokens (RTR)
    const accessToken = jwt.sign(
      { id: userData.id, email: userData.email, name: userData.name, company: userData.company, role: userData.role },
      SECRET_KEY,
      { expiresIn: '15m', algorithm: 'HS256' }
    );

    const refreshToken = jwt.sign(
      { id: userData.id, email: userData.email },
      REFRESH_SECRET_KEY,
      { expiresIn: '7d', algorithm: 'HS256' }
    );

    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    if (db) {
      await db.collection('refresh_tokens').doc(refreshTokenHash).set({
        userId: userData.id,
        expiresAt,
        rotated: false,
        createdAt: new Date().toISOString()
      });
    } else {
      inMemoryRefreshTokens.push({
        tokenHash: refreshTokenHash,
        userId: userData.id,
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

    res.status(201).json({ 
      message: 'Registration successful. A 6-digit verification code has been sent to your email.',
      token: accessToken,
      refreshToken: refreshToken,
      user: {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        company: userData.company,
        role: userData.role,
        isEmailVerified: userData.isEmailVerified,
        emailVerified: userData.isEmailVerified
      }
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

    // No longer blocking login for unverified emails!
    // We allow standard log in and will return the verification status to the frontend.


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
      user: {
        id: foundUser.id,
        name: foundUser.name,
        email: foundUser.email,
        company: foundUser.company,
        role: foundUser.role,
        isEmailVerified: foundUser.isEmailVerified,
        emailVerified: foundUser.isEmailVerified
      }
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
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
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
      refreshToken: newRefreshToken, // Include in body for client PWA storage
      user: { id: foundUser.id, name: foundUser.name, email: foundUser.email, company: foundUser.company, role: foundUser.role, photoURL: foundUser.photoURL || '' }
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
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
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
// AES-256-CBC Encryption Helpers for secure Firestore storage
// ──────────────────────────────────────────
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'a_very_secret_key_32_characters_long_!'.slice(0, 32); // Must be 32 bytes

function encrypt(text) {
  if (!text) return '';
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
  if (!text) return '';
  const textParts = text.split(':');
  if (textParts.length < 2) return '';
  const iv = Buffer.from(textParts.shift(), 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

// Helper: Generic social user creation, merging, and JWT return
async function handleSocialUser(profile, providerName, refreshTokenToStore = '') {
  const email = profile.email.toLowerCase().trim();
  const name = profile.name || email.split('@')[0];
  const avatar = profile.picture || profile.photoURL || '';

  let foundUser = null;
  if (db) {
    const snap = await db.collection('users').where('email', '==', email).get();
    if (!snap.empty) {
      foundUser = { id: snap.docs[0].id, ...snap.docs[0].data() };
      // Merge account: update missing values
      const updates = {};
      if (!foundUser.photoURL && avatar) updates.photoURL = avatar;
      if (refreshTokenToStore) {
        updates[`oauth_${providerName}_refresh_token`] = encrypt(refreshTokenToStore);
      }
      if (Object.keys(updates).length > 0) {
        await db.collection('users').doc(foundUser.id).update(updates);
      }
    } else {
      // Create new user
      const id = Date.now().toString();
      foundUser = {
        id,
        name,
        email,
        role: 'user',
        isEmailVerified: true,
        photoURL: avatar,
        createdAt: new Date().toISOString()
      };
      if (refreshTokenToStore) {
        foundUser[`oauth_${providerName}_refresh_token`] = encrypt(refreshTokenToStore);
      }
      const mockPassword = await bcrypt.hash(`social_oauth_dummy_${providerName}_${Date.now()}`, 10);
      await db.collection('users').doc(id).set({ ...foundUser, password: mockPassword });
    }
  } else {
    // In-memory
    foundUser = inMemoryUsers.find(u => u.email === email);
    if (foundUser) {
      if (avatar) foundUser.photoURL = avatar;
    } else {
      const id = Date.now().toString();
      foundUser = {
        id,
        name,
        email,
        role: 'user',
        isEmailVerified: true,
        photoURL: avatar,
        createdAt: new Date().toISOString()
      };
      inMemoryUsers.push(foundUser);
    }
  }

  // Generate Access Token (15m)
  const accessToken = jwt.sign(
    { id: foundUser.id, email: foundUser.email, name: foundUser.name, company: foundUser.company, role: foundUser.role },
    SECRET_KEY,
    { expiresIn: '15m', algorithm: 'HS256' }
  );

  // Generate Refresh Token (7d)
  const refreshToken = jwt.sign(
    { id: foundUser.id, email: foundUser.email },
    REFRESH_SECRET_KEY,
    { expiresIn: '7d', algorithm: 'HS256' }
  );

  // Store refresh token
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

  return { accessToken, refreshToken, user: { id: foundUser.id, name: foundUser.name, email: foundUser.email, company: foundUser.company, role: foundUser.role, photoURL: foundUser.photoURL || '' } };
}

// GET /api/auth/config — public endpoint to load client IDs
app.get('/api/auth/config', (req, res) => {
  res.json({
    googleClientId: process.env.GOOGLE_CLIENT_ID || '',
    facebookAppId: process.env.FACEBOOK_APP_ID || '',
    linkedinClientId: process.env.LINKEDIN_CLIENT_ID || ''
  });
});

// POST /api/auth/google/callback
app.post('/api/auth/google/callback', async (req, res, next) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ message: 'Authorization code is required.' });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const redirectUri = `${frontendUrl}/auth/callback/google`;

    // 1. Exchange code for Google access + refresh tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID || '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      throw new Error(`Google token exchange failed: ${err}`);
    }

    const tokenData = await tokenRes.json();
    const { access_token, refresh_token } = tokenData;

    // 2. Fetch Google profile
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    if (!profileRes.ok) throw new Error('Failed to retrieve user profile from Google.');
    const profile = await profileRes.json();

    // 3. Handle user syncing, database storage, and sign JWT
    const authSession = await handleSocialUser(profile, 'google', refresh_token);

    // Set HTTP-Only Cookie
    res.cookie('refreshToken', authSession.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      path: '/api/auth/refresh',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.status(200).json({ accessToken: authSession.accessToken, user: authSession.user });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/facebook/callback
app.post('/api/auth/facebook/callback', async (req, res, next) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ message: 'Authorization code is required.' });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const redirectUri = `${frontendUrl}/auth/callback/facebook`;

    // 1. Exchange code for Facebook token
    const tokenParams = new URLSearchParams({
      client_id: process.env.FACEBOOK_APP_ID || '',
      client_secret: process.env.FACEBOOK_APP_SECRET || '',
      redirect_uri: redirectUri,
      code
    });

    const tokenRes = await fetch(`https://graph.facebook.com/v18.0/oauth/access_token?${tokenParams.toString()}`);
    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      throw new Error(`Facebook token exchange failed: ${err}`);
    }
    const tokenData = await tokenRes.json();
    const access_token = tokenData.access_token;

    // 2. Fetch Facebook profile details
    const profileRes = await fetch(`https://graph.facebook.com/v18.0/me?fields=id,name,email,picture.type(large)&access_token=${access_token}`);
    if (!profileRes.ok) throw new Error('Failed to retrieve user profile from Facebook.');
    const profile = await profileRes.json();

    // Wrap to match standard social user structure
    const wrappedProfile = {
      name: profile.name,
      email: profile.email || `${profile.id}@facebook.com`,
      picture: profile.picture?.data?.url || ''
    };

    const authSession = await handleSocialUser(wrappedProfile, 'facebook');

    res.cookie('refreshToken', authSession.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      path: '/api/auth/refresh',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.status(200).json({ accessToken: authSession.accessToken, user: authSession.user });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/linkedin/callback
app.post('/api/auth/linkedin/callback', async (req, res, next) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ message: 'Authorization code is required.' });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const redirectUri = `${frontendUrl}/auth/callback/linkedin`;

    // 1. Exchange code for LinkedIn token
    const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: process.env.LINKEDIN_CLIENT_ID || '',
        client_secret: process.env.LINKEDIN_CLIENT_SECRET || '',
        redirect_uri: redirectUri
      })
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      throw new Error(`LinkedIn token exchange failed: ${err}`);
    }
    const tokenData = await tokenRes.json();
    const access_token = tokenData.access_token;

    // 2. Fetch LinkedIn userinfo profile
    const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    if (!profileRes.ok) throw new Error('Failed to retrieve user profile from LinkedIn.');
    const profile = await profileRes.json();

    // Wrap to match standard structure
    const wrappedProfile = {
      name: profile.name,
      email: profile.email,
      picture: profile.picture || ''
    };

    const authSession = await handleSocialUser(wrappedProfile, 'linkedin');

    res.cookie('refreshToken', authSession.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      path: '/api/auth/refresh',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.status(200).json({ accessToken: authSession.accessToken, user: authSession.user });
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
    const photoURL = req.body.photoURL ? String(req.body.photoURL) : undefined;

    if (!name) return res.status(400).json({ message: 'Name is required.' });

    const updates = { name, company, updatedAt: new Date().toISOString() };
    if (photoURL !== undefined) {
      updates.photoURL = photoURL;
    }

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

// GET /api/user/settings
app.get('/api/user/settings', authenticateToken, async (req, res, next) => {
  try {
    let settings = {
      taskReminders: true,
      overdueAlerts: true,
      emailAlerts: true,
      calendarReminders: true,
      morningBriefing: false,
      teamTaskAssignments: true
    };
    if (db) {
      const snap = await db.collection('users').doc(req.user.id).get();
      if (snap.exists && snap.data().notificationPreferences) {
        settings = { ...settings, ...snap.data().notificationPreferences };
      }
    } else {
      const uMatch = inMemoryUsers.find(u => u.id === req.user.id);
      if (uMatch && uMatch.notificationPreferences) {
        settings = { ...settings, ...uMatch.notificationPreferences };
      }
    }
    res.json({ settings });
  } catch (error) {
    next(error);
  }
});

// POST /api/user/settings
app.post('/api/user/settings', authenticateToken, async (req, res, next) => {
  try {
    const { settings } = req.body;
    if (!settings) return res.status(400).json({ message: 'Settings are required.' });
    const notificationPreferences = {
      emailNotifications: !!settings.emailNotifications,
      pushNotifications: !!settings.pushNotifications,
      dailySummary: !!settings.dailySummary,
      taskReminders: settings.taskReminders !== false,
      overdueAlerts: settings.overdueAlerts !== false,
      emailAlerts: settings.emailAlerts !== false,
      calendarReminders: settings.calendarReminders !== false,
      morningBriefing: !!settings.morningBriefing,
      teamTaskAssignments: settings.teamTaskAssignments !== false
    };
    if (db) {
      await db.collection('users').doc(req.user.id).set({ notificationPreferences }, { merge: true });
    } else {
      const found = inMemoryUsers.find(u => u.id === req.user.id);
      if (found) found.notificationPreferences = notificationPreferences;
    }
    res.json({ success: true, settings: notificationPreferences });
  } catch (error) {
    next(error);
  }
});

// POST /api/user/register-fcm
app.post('/api/user/register-fcm', authenticateToken, async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: 'Token is required.' });
    if (db) {
      await db.collection('users').doc(req.user.id).update({ fcmToken: token });
    } else {
      const found = inMemoryUsers.find(u => u.id === req.user.id);
      if (found) found.fcmToken = token;
    }
    console.log(`✅ Registered FCM token for user ${req.user.id}`);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// ══════════════════════════════════════════
// GEMINI AI ROUTES
// ══════════════════════════════════════════

// Safe JSON parser helper for AI responses
function cleanAndParseJSON(text) {
  try {
    let clean = text.trim();
    if (clean.startsWith('```')) {
      clean = clean.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
    }
    const parsed = JSON.parse(clean);
    return {
      executiveSummary: parsed.executiveSummary || 'Maintain core priority execution today.',
      keyRisks: Array.isArray(parsed.keyRisks) ? parsed.keyRisks.slice(0, 2) : ['Review task queue deadlines', 'Check high-priority notifications'],
      strategicFocus: parsed.strategicFocus || 'Protect time for focus and flow.',
      successMetric: parsed.successMetric || 'Complete all scheduled activities.'
    };
  } catch (err) {
    console.error('Failed to parse AI JSON response, using parser logic:', err);
    // Parse using backup regex matches if standard JSON parse failed
    try {
      const summaryMatch = text.match(/"executiveSummary"\s*:\s*"([^"]+)"/);
      const focusMatch = text.match(/"strategicFocus"\s*:\s*"([^"]+)"/);
      const metricMatch = text.match(/"successMetric"\s*:\s*"([^"]+)"/);
      return {
        executiveSummary: summaryMatch ? summaryMatch[1] : 'Executive priority review.',
        keyRisks: ['Confirm urgent tasks', 'Review schedule commitments'],
        strategicFocus: focusMatch ? focusMatch[1] : 'Maintain focused time.',
        successMetric: metricMatch ? metricMatch[1] : 'Complete priority activities successfully.'
      };
    } catch {
      return {
        executiveSummary: 'AI Briefing generation was successful. Review priorities.',
        keyRisks: ['Verify critical timelines', 'Check pending communication channels'],
        strategicFocus: 'Execute priority projects.',
        successMetric: 'Complete core tasks and deliverables.'
      };
    }
  }
}

// Morning Briefing
app.post('/api/ama/briefing', authenticateToken, async (req, res) => {
  try {
    const { date, regenerate } = req.body;
    const user = req.user;
    const today = date || new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const todayKey = new Date().toISOString().split('T')[0];

    // Check cache first (unless regenerate is true)
    if (db && !regenerate) {
      try {
        const cachedDoc = await db.collection('briefings').doc(`${user.id}_${todayKey}`).get();
        if (cachedDoc.exists()) {
          console.log(`📦 Cache hit: Retrieved daily briefing for user ${user.id}`);
          const cachedData = cachedDoc.data();
          // Backward compatibility check (if cached data is plain string, wrap it)
          if (typeof cachedData.content === 'string') {
            const parsedContent = cleanAndParseJSON(cachedData.content);
            return res.json({ briefing: parsedContent, generatedAt: cachedData.createdAt });
          }
          return res.json({ briefing: cachedData.content, generatedAt: cachedData.createdAt });
        }
      } catch (cacheErr) {
        console.warn('Firestore cache fetch failed (proceeding to generate):', cacheErr);
      }
    }

    const prompt = `You are Ryve, an executive AI Chief of Staff. Generate a structured morning briefing for ${user.name}${user.company ? `, ${user.role || 'Executive'} at ${user.company}` : ''}.

Date: ${today}

You MUST return a valid JSON object matching the exact format:
{
  "executiveSummary": "A concise, professional 2-3 sentence overview of the day's primary theme, focus, and core message.",
  "keyRisks": [
    "Short description of risk 1 (under 12 words)",
    "Short description of risk 2 (under 12 words)"
  ],
  "strategicFocus": "A single, highly specific and high-impact directive/focus recommendation.",
  "successMetric": "A single, measurable success metric/goal for the day."
}

Return ONLY the valid JSON object. Do not include markdown code block formatting (like \`\`\`json) or other text surrounding it.`;

    const text = await askAI(prompt);
    const parsedBriefing = cleanAndParseJSON(text);

    // Cache in Firestore if available
    if (db) {
      try {
        await db.collection('briefings').doc(`${user.id}_${todayKey}`).set({
          userId: user.id, date: todayKey, content: parsedBriefing, createdAt: new Date().toISOString()
        });
      } catch (cacheSetErr) {
        console.error('Failed to cache briefing in Firestore:', cacheSetErr);
      }
    }

    res.json({ briefing: parsedBriefing, generatedAt: new Date().toISOString() });
  } catch (error) {
    console.error('Briefing error:', error);
    res.status(500).json({ message: 'Failed to generate briefing.', error: error.message });
  }
});

// POST /api/briefing/generate — direct Claude endpoint
app.post('/api/briefing/generate', authenticateToken, async (req, res) => {
  try {
    const { date } = req.body;
    const user = req.user;
    const userId = user.id;
    const todayKey = date || new Date().toISOString().split('T')[0];

    // Check cache in Firestore
    if (db) {
      try {
        const cachedDoc = await db.collection('briefings').doc(`${userId}_${todayKey}`).get();
        if (cachedDoc.exists()) {
          console.log(`📦 Cache hit: Retrieved daily briefing from collection briefings under ${userId}_${todayKey}`);
          const cachedData = cachedDoc.data();
          return res.json({ briefing: cachedData.content, generatedAt: cachedData.generatedAt });
        }
      } catch (cacheErr) {
        console.warn('Firestore briefings cache fetch failed:', cacheErr);
      }
    }

    const prompt = `You are Ryve, an executive AI Chief of Staff. Generate a structured morning briefing for ${user.name}${user.company ? `, ${user.role || 'Executive'} at ${user.company}` : ''}.

Date: ${todayKey}

You MUST return a valid JSON object matching the exact format:
{
  "executiveSummary": "A concise, professional 2-3 sentence overview of the day's primary theme, focus, and core message.",
  "keyRisks": [
    "Short description of risk 1 (under 12 words)",
    "Short description of risk 2 (under 12 words)"
  ],
  "strategicFocus": "A single, highly specific and high-impact directive/focus recommendation.",
  "successMetric": "A single, measurable success metric/goal for the day."
}

Return ONLY the valid JSON object. Do not include markdown code block formatting (like \`\`\`json) or other text surrounding it.`;

    let textResponse = '';
    try {
      textResponse = await askAI(prompt, 'You are Ryve, an elite AI Chief of Staff. Generate sharp, executive-level strategic briefings. Be concise, direct, and actionable. Never use placeholder text. Never say you cannot generate content. Always return valid JSON.');
    } catch (aiErr) {
      console.error('Failed to generate briefing via OpenRouter/AI:', aiErr);
      return res.status(503).json({ error: 'AI unavailable' });
    }

    const parsedBriefing = cleanAndParseJSON(textResponse);

    // Cache in Firestore
    if (db) {
      try {
        await db.collection('briefings').doc(`${userId}_${todayKey}`).set({
          userId,
          date: todayKey,
          content: parsedBriefing,
          generatedAt: new Date().toISOString()
        });
      } catch (cacheSetErr) {
        console.error('Failed to cache briefing in Firestore briefings collection:', cacheSetErr);
      }
    }

    res.json({ briefing: parsedBriefing, generatedAt: new Date().toISOString() });
  } catch (error) {
    console.error('Briefing generation error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
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
  // If the frontend sent a full system prompt, use it directly — it already contains
  // banned phrases, conversational rules, and action block schemas.
  // Only build a default if no client prompt was provided.
  let systemContext;
  if (clientSystemPrompt) {
    systemContext = clientSystemPrompt;
  } else {
    systemContext = `You are Ama, a sophisticated and helpful AI Chief of Staff for ${ctx.name}${ctx.company ? ` at ${ctx.company}` : ''}. You are concise, highly accurate, professional, and provide direct, actionable, and complete answers immediately. You act like a proactive executive assistant, prioritizing action over interrogation.

FRICTIONLESS EXECUTIVE ASSISTANCE PRINCIPLES:
- GATHER ONLY ESSENTIAL INFORMATION: For meeting scheduling, only ask for Title, Date, and Time. Fields like Duration, Location, and Number of Attendees are optional. Apply sensible defaults (e.g., 1 hour duration, online meeting, 2 attendees) and proceed without asking the user.
- NEVER ASK MORE THAN TWO CLARIFYING QUESTIONS AT ONCE: If additional details are genuinely needed, ask one follow-up at a time, only after the user has responded.
- APPLY CONTEXTUAL DEFAULTS ACROSS ALL TASKS: Whether the user is creating a task, drafting an email, setting a reminder, or taking action, infer reasonable defaults from context. Act on partial information and avoid presenting checklists of required fields.
- PRIORITIZE ACTION OVER INTERROGATION: If the user's intent is clear, attempt to complete the task immediately, output the required JSON Action Block, confirm the result, and offer to adjust details afterward if needed.

Use structured Markdown. DO NOT use generic phrases like "I processed your request" — always give a real, helpful answer.`;
  }

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

// ──────────────────────────────────────────
// AI-TRIGGERED GMAIL SEND  (/api/ama/send-email)
// ──────────────────────────────────────────
// Called by the frontend after user confirms an AI-drafted email.
app.post('/api/ama/send-email', optionalAuth, async (req, res, next) => {
  try {
    const { gmailEmail, to, subject, body } = req.body;
    if (!gmailEmail || !to || !subject || !body) {
      return res.status(400).json({ message: 'gmailEmail, to, subject, and body are required.' });
    }

    let auth;
    try {
      if (req.user && req.user.id !== 'guest') {
        auth = await getOAuthClientForUser(req.user.id);
      } else {
        const stored = gmailTokenStore.get(String(gmailEmail));
        if (!stored) {
          return res.status(401).json({ message: 'Gmail not connected. Please connect your Gmail account first.' });
        }
        auth = makeOAuth2(stored.tokens);
      }
    } catch (authErr) {
      const stored = gmailTokenStore.get(String(gmailEmail));
      if (!stored) {
        return res.status(401).json({ message: 'Gmail not connected. Please connect your Gmail account first.' });
      }
      auth = makeOAuth2(stored.tokens);
    }
    const raw = Buffer.from(
      `To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}`
    ).toString('base64url');

    await google.gmail({ version: 'v1', auth }).users.messages.send({
      userId: 'me',
      requestBody: { raw },
    });

    logStructured('INFO', 'AI_GMAIL_SEND', { gmailEmail, to, subject });
    res.json({ success: true, message: `Email sent to ${to}` });
  } catch (err) {
    next(err);
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
const GMAIL_REDIRECT_URI  = process.env.GMAIL_REDIRECT_URI || `http://localhost:${process.env.PORT || 5000}/auth/gmail/callback`;
const GMAIL_FRONTEND_URL  = process.env.FRONTEND_URL || 'http://localhost:5173';

// In-memory token store (keyed by gmail address)
const gmailTokenStore = new Map();

// ── Boot: load all saved Gmail tokens from Firestore ───────────────────────
async function loadGmailTokens() {
  if (!db) return;
  try {
    const snap = await db.collection('gmail_tokens').get();
    snap.forEach(doc => {
      const { email, tokens } = doc.data();
      if (email && tokens) {
        gmailTokenStore.set(email, { email, tokens });
        console.log('✅ Restored Gmail token for:', email);
      }
    });
  } catch (err) {
    console.warn('⚠️  Could not load Gmail tokens from Firestore:', err.message);
  }
}
loadGmailTokens();

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

async function getOAuthClientForUser(uid) {
  if (!db) {
    const foundUser = inMemoryUsers.find(u => u.id === uid);
    if (!foundUser || !foundUser.gmail) throw new Error('Gmail integration not connected.');
    const { accessToken, refreshToken, expiryDate } = foundUser.gmail;
    const tokens = { access_token: accessToken, refresh_token: refreshToken, expiry_date: expiryDate };
    const oauth2 = makeOAuth2(tokens);
    if (Date.now() >= expiryDate - 60000) {
      try {
        const { credentials } = await oauth2.refreshAccessToken();
        foundUser.gmail.accessToken = credentials.access_token;
        foundUser.gmail.expiryDate = credentials.expiry_date;
        oauth2.setCredentials(credentials);
      } catch (err) {
        console.error('Failed to silently refresh Google access token in-memory:', err.message);
      }
    }
    return oauth2;
  }

  const userDoc = await db.collection('users').doc(uid).get();
  if (!userDoc.exists || !userDoc.data().gmail) throw new Error('Gmail integration not connected.');
  const { accessToken, refreshToken, expiryDate } = userDoc.data().gmail;
  const tokens = { access_token: accessToken, refresh_token: refreshToken, expiry_date: expiryDate };
  const oauth2 = makeOAuth2(tokens);
  if (Date.now() >= expiryDate - 60000) {
    try {
      const { credentials } = await oauth2.refreshAccessToken();
      await db.collection('users').doc(uid).update({
        'gmail.accessToken': credentials.access_token,
        'gmail.expiryDate': credentials.expiry_date
      });
      oauth2.setCredentials(credentials);
    } catch (err) {
      console.error('Failed to silently refresh Google access token in Firestore:', err.message);
    }
  }
  return oauth2;
}


// GET /auth/gmail  — public endpoint to initiate Google OAuth consent flow directly
app.get('/auth/gmail', async (req, res, next) => {
  try {
    const uid = req.query.uid || '';
    const state = uid ? uid : Math.random().toString(36).slice(2);
    
    let emailHint = '';
    if (db && uid && uid.length > 5) {
      try {
        const userDoc = await db.collection('users').doc(uid).get();
        if (userDoc.exists) {
          emailHint = userDoc.data().email || '';
        }
      } catch (dbErr) {
        console.warn('⚠️ Firestore lookup failed in /auth/gmail:', dbErr.message);
      }
    } else if (uid) {
      const foundUser = inMemoryUsers.find(u => u.id === uid);
      if (foundUser) {
        emailHint = foundUser.email || '';
      }
    }

    const url = makeOAuth2().generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      state,
      ...(emailHint && { login_hint: emailHint }),
      scope: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/calendar.readonly'
      ],
    });
    res.redirect(url);
  } catch (err) {
    next(err);
  }
});

// GET /auth/gmail/callback  — public endpoint where Google redirects after consent approval
app.get('/auth/gmail/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code) return res.status(400).send('Missing code');
  try {
    const oauth2 = makeOAuth2();
    const { tokens } = await oauth2.getToken(String(code));
    oauth2.setCredentials(tokens);
    const { data } = await google.oauth2({ version: 'v2', auth: oauth2 }).userinfo.get();
    gmailTokenStore.set(data.email, { tokens, email: data.email });
    console.log('✅ Gmail connected for:', data.email);

    const uid = state;
    let ryveUserEmail = '';
    if (db && uid && uid.length > 5) {
      const userDoc = await db.collection('users').doc(uid).get();
      if (userDoc.exists) {
        ryveUserEmail = userDoc.data().email || '';
      }
    } else if (uid) {
      const foundUser = inMemoryUsers.find(u => u.id === uid);
      if (foundUser) {
        ryveUserEmail = foundUser.email || '';
      }
    }

    if (ryveUserEmail && String(data.email).toLowerCase() !== String(ryveUserEmail).toLowerCase()) {
      console.warn(`⚠️ Gmail email mismatch: Connected ${data.email} but registered as ${ryveUserEmail}`);
      return res.redirect(`${GMAIL_FRONTEND_URL}/dashboard?gmail_error=wrong_account`);
    }

    if (db && uid && uid.length > 5) {
      // Look up existing tokens to preserve refresh token if missing
      let existingRefreshToken = tokens.refresh_token;
      if (!existingRefreshToken) {
        const userDoc = await db.collection('users').doc(uid).get();
        if (userDoc.exists) {
          existingRefreshToken = userDoc.data()?.gmail?.refreshToken;
        }
      }

      await db.collection('users').doc(uid).set({
        gmail: {
          accessToken: tokens.access_token,
          refreshToken: existingRefreshToken || '',
          expiryDate: tokens.expiry_date,
          connectedEmail: data.email,
          connectedAt: new Date().toISOString()
        }
      }, { merge: true }).catch(err => console.error('Failed to persist Gmail tokens under user:', err.message));
    } else {
      // In-memory fallback
      const foundUser = inMemoryUsers.find(u => u.id === uid);
      if (foundUser) {
        foundUser.gmail = {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || foundUser.gmail?.refreshToken || '',
          expiryDate: tokens.expiry_date,
          connectedEmail: data.email,
          connectedAt: new Date().toISOString()
        };
      }
    }

    if (db) {
      db.collection('gmail_tokens').doc(data.email).set({ email: data.email, tokens, updatedAt: new Date().toISOString() })
        .catch(err => console.error('Failed to persist Gmail token in legacy table:', err.message));
    }

    res.redirect(`${GMAIL_FRONTEND_URL}/dashboard?gmail_connected=${encodeURIComponent(data.email)}`);
  } catch (err) {
    console.error('Gmail callback error:', err.message);
    res.redirect(`${GMAIL_FRONTEND_URL}/dashboard?gmail_error=${encodeURIComponent(err.message)}`);
  }
});

// GET /api/gmail/auth  — returns the Google OAuth consent URL (optional auth fallback)
app.get('/api/gmail/auth', optionalAuth, (req, res, next) => {
  try {
    const login_hint = req.user?.email;
    const uid = req.user?.id || '';
    const state = uid ? uid : Math.random().toString(36).slice(2);
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

// GET /api/gmail/callback  — Google redirects here after user approves (legacy api fallback support)
app.get('/api/gmail/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code) return res.status(400).send('Missing code');
  try {
    const oauth2 = makeOAuth2();
    const { tokens } = await oauth2.getToken(String(code));
    oauth2.setCredentials(tokens);
    const { data } = await google.oauth2({ version: 'v2', auth: oauth2 }).userinfo.get();
    gmailTokenStore.set(data.email, { tokens, email: data.email });
    console.log('✅ Gmail connected for:', data.email);

    const uid = state;
    let ryveUserEmail = '';
    if (db && uid && uid.length > 5) {
      const userDoc = await db.collection('users').doc(uid).get();
      if (userDoc.exists) {
        ryveUserEmail = userDoc.data().email || '';
      }
    } else if (uid) {
      const foundUser = inMemoryUsers.find(u => u.id === uid);
      if (foundUser) {
        ryveUserEmail = foundUser.email || '';
      }
    }

    if (ryveUserEmail && String(data.email).toLowerCase() !== String(ryveUserEmail).toLowerCase()) {
      console.warn(`⚠️ Gmail email mismatch: Connected ${data.email} but registered as ${ryveUserEmail}`);
      return res.redirect(`${GMAIL_FRONTEND_URL}/dashboard?gmail_error=wrong_account`);
    }

    if (db && uid && uid.length > 5) {
      // Look up existing tokens to preserve refresh token if missing
      let existingRefreshToken = tokens.refresh_token;
      if (!existingRefreshToken) {
        const userDoc = await db.collection('users').doc(uid).get();
        if (userDoc.exists) {
          existingRefreshToken = userDoc.data()?.gmail?.refreshToken;
        }
      }

      await db.collection('users').doc(uid).set({
        gmail: {
          accessToken: tokens.access_token,
          refreshToken: existingRefreshToken || '',
          expiryDate: tokens.expiry_date,
          connectedEmail: data.email,
          connectedAt: new Date().toISOString()
        }
      }, { merge: true }).catch(err => console.error('Failed to persist Gmail tokens under user in legacy API callback:', err.message));
    } else {
      // In-memory fallback
      const foundUser = inMemoryUsers.find(u => u.id === uid);
      if (foundUser) {
        foundUser.gmail = {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || foundUser.gmail?.refreshToken || '',
          expiryDate: tokens.expiry_date,
          connectedEmail: data.email,
          connectedAt: new Date().toISOString()
        };
      }
    }

    if (db) {
      db.collection('gmail_tokens').doc(data.email).set({ email: data.email, tokens, updatedAt: new Date().toISOString() })
        .catch(err => console.error('Failed to persist Gmail token in legacy table:', err.message));
    }
    res.redirect(`${GMAIL_FRONTEND_URL}/dashboard?gmail_connected=${encodeURIComponent(data.email)}`);
  } catch (err) {
    console.error('Gmail callback error:', err.message);
    res.redirect(`${GMAIL_FRONTEND_URL}/dashboard?gmail_error=${encodeURIComponent(err.message)}`);
  }
});


// GET /api/gmail/status?email=...
app.get('/api/gmail/status', authenticateToken, async (req, res) => {
  try {
    let gmail = null;
    if (db) {
      const userDoc = await db.collection('users').doc(req.user.id).get();
      if (userDoc.exists) gmail = userDoc.data().gmail;
    } else {
      const foundUser = inMemoryUsers.find(u => u.id === req.user.id);
      if (foundUser) gmail = foundUser.gmail;
    }

    const emailParam = req.query.email;
    if (emailParam) {
      const connected = (gmail && gmail.refreshToken && String(gmail.connectedEmail).toLowerCase() === String(emailParam).toLowerCase()) || gmailTokenStore.has(String(emailParam));
      return res.json({ connected });
    }

    if (gmail && gmail.refreshToken) {
      return res.json({ connected: true, email: gmail.connectedEmail });
    }
    
    // Legacy fallback check using user email
    const legacyConnected = gmailTokenStore.has(req.user.email);
    if (legacyConnected) {
      return res.json({ connected: true, email: req.user.email });
    }

    return res.json({ connected: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/gmail/disconnect  — disconnects and revokes user Gmail tokens
app.post('/api/gmail/disconnect', authenticateToken, async (req, res, next) => {
  try {
    const uid = req.user.id;
    let gmail = null;
    
    if (db) {
      const userDoc = await db.collection('users').doc(uid).get();
      if (userDoc.exists) gmail = userDoc.data().gmail;
    } else {
      const foundUser = inMemoryUsers.find(u => u.id === uid);
      if (foundUser) gmail = foundUser.gmail;
    }

    if (gmail && gmail.accessToken) {
      try {
        const oauth2 = makeOAuth2();
        await oauth2.revokeToken(gmail.accessToken);
      } catch (revokeErr) {
        console.warn('⚠️ Token revocation warning (might already be revoked):', revokeErr.message);
      }
    }

    if (db) {
      await db.collection('users').doc(uid).update({
        gmail: admin.firestore.FieldValue.delete()
      }).catch(() => {});
    } else {
      const foundUser = inMemoryUsers.find(u => u.id === uid);
      if (foundUser) delete foundUser.gmail;
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Helper: parse a raw Gmail message into our Email shape
function parseGmailMessage(msg) {
  const headers = msg.payload?.headers || [];
  const hdr = (n) => headers.find(h => h.name.toLowerCase() === n.toLowerCase())?.value || '';
  const from    = hdr('From');
  const m = from.match(/^(.+?)\s*<(.+?)>$/) || [];
  const fromName  = (m[1] || from).replace(/"/g, '').trim();
  const fromEmail = (m[2] || from).trim();

  let htmlBody = '';
  let textBody = '';

  const extract = (part) => {
    if (!part) return;
    if (part.mimeType === 'text/html' && part.body?.data && !htmlBody) {
      htmlBody = Buffer.from(part.body.data, 'base64').toString('utf-8');
    } else if (part.mimeType === 'text/plain' && part.body?.data && !textBody) {
      textBody = Buffer.from(part.body.data, 'base64').toString('utf-8');
    }
    if (part.parts) part.parts.forEach(extract);
  };
  extract(msg.payload);

  // Fallback: top-level body (single-part messages)
  if (!htmlBody && !textBody && msg.payload?.body?.data) {
    const decoded = Buffer.from(msg.payload.body.data, 'base64').toString('utf-8');
    if (msg.payload?.mimeType === 'text/html') {
      htmlBody = decoded;
    } else {
      textBody = decoded;
    }
  }

  // Prefer HTML, fall back to plain text
  const body = htmlBody || textBody || '';
  const mimeType = htmlBody ? 'text/html' : 'text/plain';

  const preview = (textBody || htmlBody.replace(/<[^>]+>/g, '') || '').replace(/\s+/g, ' ').trim().slice(0, 130) + (body.length > 130 ? '…' : '');
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
    mimeType,
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

// GET /api/gmail/messages
app.get('/api/gmail/messages', authenticateToken, async (req, res, next) => {
  const { maxResults = 50, pageToken } = req.query;

  try {
    const auth = await getOAuthClientForUser(req.user.id);
    const gmail = google.gmail({ version: 'v1', auth });
    
    // Fetch only Primary category emails (q=category:primary)
    const list = await gmail.users.messages.list({
      userId: 'me',
      labelIds: ['INBOX'],
      q: 'category:primary',
      maxResults: Number(maxResults),
      ...(pageToken && { pageToken })
    });
    
    const ids = (list.data.messages || []).map(m => m.id);
    const nextPageToken = list.data.nextPageToken || null;
    
    if (!ids.length) {
      return res.json({ emails: [], nextPageToken });
    }
    
    const raw = await Promise.all(ids.map(id => 
      gmail.users.messages.get({ userId: 'me', id, format: 'full' })
        .then(r => r.data)
    ));
    
    const emails = raw.map(parseGmailMessage);
    
    // Store emails in Firestore for offline access!
    if (db) {
      try {
        const batch = db.batch();
        emails.forEach(email => {
          const ref = db.collection('users').doc(req.user.id).collection('emails').doc(email.id);
          batch.set(ref, email, { merge: true });
        });
        await batch.commit();
      } catch (cacheErr) {
        console.error('Failed to cache emails to Firestore:', cacheErr.message);
      }
    }
    
    // Send FCM notification for any new unread email received!
    if (db) {
      try {
        for (const email of emails) {
          if (!email.isRead) {
            // Check if we already have it in the cache
            const ref = db.collection('users').doc(req.user.id).collection('emails').doc(email.id);
            const cachedDoc = await ref.get();
            if (!cachedDoc.exists) {
              // This is a brand new email!
              await sendNotification(req.user.id, 'New Email', `From ${email.from}: ${email.subject}`, `/dashboard?tab=email`);
            }
          }
        }
      } catch (notifErr) {
        console.error('Failed to check or send email notification:', notifErr.message);
      }
    }
    
    res.json({ emails, nextPageToken });
  } catch (err) {
    next(err);
  }
});

// POST /api/gmail/archive  { email, messageId }
app.post('/api/gmail/archive', authenticateToken, requireEmailOwnership, async (req, res, next) => {
  const { messageId } = req.body;
  try {
    const auth = await getOAuthClientForUser(req.user.id);
    await google.gmail({ version: 'v1', auth }).users.messages.modify({ userId: 'me', id: messageId, requestBody: { removeLabelIds: ['INBOX'] } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /api/gmail/read  { email, messageId }
app.post('/api/gmail/read', authenticateToken, requireEmailOwnership, async (req, res, next) => {
  const { messageId } = req.body;
  try {
    const auth = await getOAuthClientForUser(req.user.id);
    await google.gmail({ version: 'v1', auth }).users.messages.modify({ userId: 'me', id: messageId, requestBody: { removeLabelIds: ['UNREAD'] } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /api/gmail/send  { email, to, subject, body, threadId }
app.post('/api/gmail/send', authenticateToken, requireEmailOwnership, async (req, res, next) => {
  const { to, subject, body, threadId } = req.body;
  try {
    const auth = await getOAuthClientForUser(req.user.id);
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
  const { timeMin, timeMax } = req.query;

  try {
    const auth = await getOAuthClientForUser(req.user.id);
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
  const { title, date, time, duration } = req.body;

  try {
    const auth = await getOAuthClientForUser(req.user.id);
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

// ──────────────────────────────────────────
// FCM NOTIFICATION HELPER
// ──────────────────────────────────────────
async function sendNotification(uid, title, body, clickAction = '/dashboard', type = 'emailAlerts') {
  if (!db) {
    console.log(`[Notification Fallback] User: ${uid} | Title: ${title} | Body: ${body}`);
    return;
  }
  try {
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) return;
    const userData = userDoc.data();
    
    // Check notification preference for this type
    const prefs = userData.notificationPreferences || {
      taskReminders: true,
      overdueAlerts: true,
      emailAlerts: true,
      calendarReminders: true,
      morningBriefing: false,
      teamTaskAssignments: true
    };
    
    if (prefs[type] === false) {
      console.log(`✉️ Notification skipped: User ${uid} disabled type "${type}"`);
      return;
    }
    
    const fcmToken = userData.fcmToken;
    if (!fcmToken) {
      console.log(`✉️ Notification skipped: No FCM token registered for user ${uid}`);
      return;
    }
    
    const message = {
      token: fcmToken,
      notification: {
        title,
        body
      },
      data: {
        clickAction,
        title,
        body
      },
      webpush: {
        fcmOptions: {
          link: clickAction
        }
      }
    };
    
    await admin.messaging().send(message);
    console.log(`🚀 FCM push notification sent to user ${uid}: "${title}"`);
    
    // Save to user's notifications collection history
    await db.collection('users').doc(uid).collection('notifications').add({
      title,
      body,
      clickAction,
      type,
      sentAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('❌ Failed to send FCM notification:', err.message);
  }
}

// ──────────────────────────────────────────
// PERIODIC CHECKER RUNNER (Every 10 mins)
// ──────────────────────────────────────────
async function runPeriodicNotificationChecks() {
  if (!db) return;
  console.log('⏰ Running periodic notification checks...');
  
  try {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    
    // 1. Tasks Checks (Due Today & Overdue)
    const tasksSnap = await db.collection('tasks').get();
    for (const doc of tasksSnap.docs) {
      const task = doc.data();
      if (task.completed) continue;
      
      const userId = task.userId;
      if (!userId) continue;
      
      const taskId = doc.id;
      const dueDate = task.dueDate;
      if (!dueDate) continue;
      
      const taskDueStr = dueDate.split('T')[0];
      
      if (taskDueStr === todayStr) {
        // Due Today!
        const alertKey = `${userId}_${taskId}_taskReminders`;
        const alertRef = db.collection('sent_alerts').doc(alertKey);
        const alertDoc = await alertRef.get();
        if (!alertDoc.exists) {
          await alertRef.set({ sentAt: now.toISOString() });
          await sendNotification(
            userId,
            'Task Due Today',
            `"${task.title}" is due today.`,
            '/dashboard?tab=tasks',
            'taskReminders'
          );
        }
      } else if (new Date(taskDueStr) < new Date(todayStr)) {
        // Overdue!
        const alertKey = `${userId}_${taskId}_overdueAlerts`;
        const alertRef = db.collection('sent_alerts').doc(alertKey);
        const alertDoc = await alertRef.get();
        if (!alertDoc.exists) {
          await alertRef.set({ sentAt: now.toISOString() });
          await sendNotification(
            userId,
            'Overdue Task Alert',
            `"${task.title}" is overdue!`,
            '/dashboard?tab=tasks',
            'overdueAlerts'
          );
        }
      }
    }
    
    // 2. Calendar Event Checks (Starting in 30 minutes)
    const eventsSnap = await db.collection('events').get();
    for (const doc of eventsSnap.docs) {
      const event = doc.data();
      const userId = event.userId;
      if (!userId || !event.startTime) continue;
      
      const eventId = doc.id;
      const startTime = new Date(event.startTime);
      const diffMs = startTime.getTime() - now.getTime();
      const diffMins = diffMs / 60000;
      
      if (diffMins > 0 && diffMins <= 30) {
        const alertKey = `${userId}_${eventId}_calendarReminders`;
        const alertRef = db.collection('sent_alerts').doc(alertKey);
        const alertDoc = await alertRef.get();
        if (!alertDoc.exists) {
          await alertRef.set({ sentAt: now.toISOString() });
          await sendNotification(
            userId,
            'Upcoming Event Reminder',
            `"${event.title}" starts in ${Math.round(diffMins)} minutes!`,
            '/dashboard?tab=calendar',
            'calendarReminders'
          );
        }
      }
    }
  } catch (err) {
    console.error('❌ Error running periodic checks:', err.message);
  }
}

// Start background interval (every 10 minutes)
setInterval(runPeriodicNotificationChecks, 10 * 60 * 1000);
// Trigger initial run after 30 seconds
setTimeout(runPeriodicNotificationChecks, 30000);

app.listen(PORT, () => {
  console.log(`\n🚀 Ama Backend running at http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
});

