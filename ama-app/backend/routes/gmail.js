const express = require('express');
const router = express.Router();
const { google } = require('googleapis');

const CLIENT_ID     = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI  = process.env.GMAIL_REDIRECT_URI || 'http://localhost:5000/api/gmail/callback';
const FRONTEND_URL  = process.env.FRONTEND_URL || 'http://localhost:5173';

// In-memory token store (keyed by state token → user session)
// For production use Redis or a DB.
const tokenStore = new Map();

function makeOAuth2Client() {
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
}

// ── 1. Start OAuth flow ───────────────────────────────────────────────────────
// GET /api/gmail/auth  → returns { url }
router.get('/auth', (req, res) => {
  const oauth2 = makeOAuth2Client();
  const state = Math.random().toString(36).slice(2);

  const url = oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
    state,
  });

  // Store state so callback can look it up
  tokenStore.set(`state_${state}`, { createdAt: Date.now() });
  res.json({ url, state });
});

// ── 2. OAuth callback ─────────────────────────────────────────────────────────
// GET /api/gmail/callback?code=...&state=...
router.get('/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code) return res.status(400).send('Missing code');

  try {
    const oauth2 = makeOAuth2Client();
    const { tokens } = await oauth2.getToken(code);
    oauth2.setCredentials(tokens);

    // Get user email to use as identifier
    const oauth2Api = google.oauth2({ version: 'v2', auth: oauth2 });
    const { data: userInfo } = await oauth2Api.userinfo.get();

    // Store tokens keyed by Gmail address
    tokenStore.set(`gmail_${userInfo.email}`, { tokens, email: userInfo.email });

    // Redirect back to frontend with the Gmail address as a param
    res.redirect(`${FRONTEND_URL}?gmail_connected=${encodeURIComponent(userInfo.email)}`);
  } catch (err) {
    console.error('Gmail callback error:', err.message);
    res.redirect(`${FRONTEND_URL}?gmail_error=${encodeURIComponent(err.message)}`);
  }
});

// ── Helper: get authenticated Gmail client from stored tokens ─────────────────
function getAuthClientForEmail(gmailEmail) {
  const stored = tokenStore.get(`gmail_${gmailEmail}`);
  if (!stored) return null;
  const oauth2 = makeOAuth2Client();
  oauth2.setCredentials(stored.tokens);
  // Auto-refresh
  oauth2.on('tokens', (newTokens) => {
    if (newTokens.refresh_token) stored.tokens.refresh_token = newTokens.refresh_token;
    stored.tokens.access_token = newTokens.access_token;
    stored.tokens.expiry_date  = newTokens.expiry_date;
  });
  return oauth2;
}

// ── Helper: parse a Gmail message into our Email shape ─────────────────────────
function parseMessage(msg) {
  const headers = msg.payload?.headers || [];
  const get = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

  const subject = get('Subject') || '(no subject)';
  const from    = get('From');
  const date    = get('Date');
  const toHeader = get('To');

  // Parse "Name <email>" or just "email"
  const fromMatch = from.match(/^(.+?)\s*<(.+?)>$/) || [null, from, from];
  const fromName  = (fromMatch[1] || from).replace(/"/g, '').trim();
  const fromEmail = (fromMatch[2] || from).trim();

  // Extract body
  let body = '';
  const extractText = (part) => {
    if (!part) return;
    if (part.mimeType === 'text/plain' && part.body?.data) {
      body = Buffer.from(part.body.data, 'base64').toString('utf-8');
    } else if (part.parts) {
      part.parts.forEach(extractText);
    }
  };
  extractText(msg.payload);
  if (!body && msg.payload?.body?.data) {
    body = Buffer.from(msg.payload.body.data, 'base64').toString('utf-8');
  }

  const preview = body.replace(/\s+/g, ' ').slice(0, 120) + (body.length > 120 ? '…' : '');

  const labelIds = msg.labelIds || [];
  const isRead   = !labelIds.includes('UNREAD');
  const isStarred = labelIds.includes('STARRED');

  // Rough time label
  const msgDate = date ? new Date(date) : new Date();
  const now     = new Date();
  const diffH   = (now - msgDate) / 3600000;
  let timeLabel;
  if (diffH < 24) {
    timeLabel = msgDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } else if (diffH < 48) {
    timeLabel = 'Yesterday';
  } else {
    timeLabel = msgDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  const hasAttachments = (msg.payload?.parts || []).some(p => p.filename && p.filename.length > 0);

  return {
    id:             msg.id,
    threadId:       msg.threadId,
    from:           fromName,
    fromEmail,
    to:             toHeader,
    subject,
    preview,
    body,
    time:           timeLabel,
    date:           msgDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    priority:       'normal',
    category:       'fyi',
    labels:         labelIds,
    isRead,
    isStarred,
    hasAttachments,
  };
}

// ── 3. Fetch inbox messages ───────────────────────────────────────────────────
// GET /api/gmail/messages?email=user@gmail.com&maxResults=20
router.get('/messages', async (req, res) => {
  const { email, maxResults = 20 } = req.query;
  if (!email) return res.status(400).json({ message: 'email query param required' });

  const auth = getAuthClientForEmail(email);
  if (!auth) return res.status(401).json({ message: 'Gmail not connected for this email' });

  try {
    const gmail = google.gmail({ version: 'v1', auth });

    // List message IDs
    const listRes = await gmail.users.messages.list({
      userId: 'me',
      labelIds: ['INBOX'],
      maxResults: parseInt(maxResults),
    });

    const ids = (listRes.data.messages || []).map(m => m.id);
    if (ids.length === 0) return res.json({ emails: [] });

    // Fetch each message (full format)
    const messages = await Promise.all(
      ids.map(id => gmail.users.messages.get({ userId: 'me', id, format: 'full' }).then(r => r.data))
    );

    const emails = messages.map(parseMessage);
    res.json({ emails });
  } catch (err) {
    console.error('Gmail fetch error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// ── 4. Archive (remove INBOX label) ──────────────────────────────────────────
// POST /api/gmail/archive  { email, messageId }
router.post('/archive', async (req, res) => {
  const { email, messageId } = req.body;
  const auth = getAuthClientForEmail(email);
  if (!auth) return res.status(401).json({ message: 'Not connected' });

  try {
    const gmail = google.gmail({ version: 'v1', auth });
    await gmail.users.messages.modify({
      userId: 'me', id: messageId,
      requestBody: { removeLabelIds: ['INBOX'] },
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── 5. Mark as read ───────────────────────────────────────────────────────────
// POST /api/gmail/read  { email, messageId }
router.post('/read', async (req, res) => {
  const { email, messageId } = req.body;
  const auth = getAuthClientForEmail(email);
  if (!auth) return res.status(401).json({ message: 'Not connected' });

  try {
    const gmail = google.gmail({ version: 'v1', auth });
    await gmail.users.messages.modify({
      userId: 'me', id: messageId,
      requestBody: { removeLabelIds: ['UNREAD'] },
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── 6. Send reply ─────────────────────────────────────────────────────────────
// POST /api/gmail/send  { email, to, subject, body, threadId }
router.post('/send', async (req, res) => {
  const { email, to, subject, body, threadId } = req.body;
  const auth = getAuthClientForEmail(email);
  if (!auth) return res.status(401).json({ message: 'Not connected' });

  try {
    const gmail = google.gmail({ version: 'v1', auth });
    const raw = Buffer.from(
      `To: ${to}\r\nSubject: Re: ${subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}`
    ).toString('base64url');

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw, ...(threadId ? { threadId } : {}) },
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── 7. Check if email is connected ───────────────────────────────────────────
// GET /api/gmail/status?email=...
router.get('/status', (req, res) => {
  const { email } = req.query;
  const connected = email ? tokenStore.has(`gmail_${email}`) : false;
  res.json({ connected });
});

module.exports = router;
