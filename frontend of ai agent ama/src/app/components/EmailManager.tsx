import { useState, useEffect, useCallback } from 'react';
import {
  Mail, Search, Archive, Trash2, Reply, Star, RefreshCw,
  FileText, Bell, UserX, Sparkles, Loader2, X, Send as SendIcon,
  AlertCircle, Inbox,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

import { API_BASE as API } from '../utils/config';

interface GmailMessage {
  id: string;
  threadId: string;
  from: string;
  fromEmail: string;
  subject: string;
  preview: string;
  body: string;
  time: string;
  date: string;
  isRead: boolean;
  isStarred: boolean;
  hasAttachments: boolean;
  labels: string[];
  priority: string;
  category: string;
  draftReply?: string;
}

export function EmailManager() {
  const { user, token } = useAuth();

  const [gmailEmail, setGmailEmail] = useState<string | null>(() => localStorage.getItem('ama_gmail_email'));
  const [connected, setConnected] = useState(false);
  const [emails, setEmails] = useState<GmailMessage[]>([]);
  const [selected, setSelected] = useState<GmailMessage | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread' | 'starred'>('all');
  const [draftReply, setDraftReply] = useState('');
  const [showReply, setShowReply] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);

  // ── Check for ?gmail_connected= in URL after OAuth redirect ──────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gEmail = params.get('gmail_connected');
    const gError = params.get('gmail_error');

    if (gEmail) {
      const decoded = decodeURIComponent(gEmail);
      localStorage.setItem('ama_gmail_email', decoded);
      setGmailEmail(decoded);
      // showToast(`Gmail connected: ${decoded}`, 'success');
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (gError) {
      // showToast(`Gmail error: ${decodeURIComponent(gError)}`, 'error');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // ── Fetch inbox ──────────────────────────────────────────────────────────
  const fetchEmails = useCallback(async (email: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/gmail/messages?email=${encodeURIComponent(email)}&maxResults=25`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Fetch failed');
      setEmails(data.emails || []);
      if ((data.emails || []).length > 0) setSelected(data.emails[0]);
    } catch (err: any) {
      // showToast(err.message || 'Could not fetch Gmail', 'error');
    } finally {
      setLoading(false);
    }
  }, [token]);

  // ── Check connection status on mount ────────────────────────────────────
  useEffect(() => {
    if (!gmailEmail) return;
    fetch(`${API}/api/gmail/status?email=${encodeURIComponent(gmailEmail)}`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    })
      .then(r => r.json())
      .then(d => {
        setConnected(d.connected);
        if (d.connected) fetchEmails(gmailEmail);
      })
      .catch(() => setConnected(false));
  }, [gmailEmail, token, fetchEmails]);

  // ── Start Gmail OAuth ────────────────────────────────────────────────────
  const handleConnectGmail = async () => {
    try {
      const res = await fetch(`${API}/api/gmail/auth`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      const data = await res.json();
      if (data.url) {
        // showToast('Opening Google sign-in…', 'info');
        window.location.href = data.url;
      }
    } catch {
      // showToast('Could not reach backend. Is it running?', 'error');
    }
  };

  const handleDisconnect = () => {
    localStorage.removeItem('ama_gmail_email');
    setGmailEmail(null);
    setConnected(false);
    setEmails([]);
    setSelected(null);
    // showToast('Gmail disconnected', 'info');
  };


  const handleSync = async () => {
    if (!gmailEmail || !connected) return;
    setSyncing(true);
    // const toastId = showToast('Syncing Gmail…', 'loading');
    await fetchEmails(gmailEmail);
    // removeToast(toastId);
    // showToast('Inbox synced!', 'success');
    setSyncing(false);
  };

  // ── Actions ───────────────────────────────────────────────────────────────
  const markRead = async (msg: GmailMessage) => {
    if (msg.isRead || !gmailEmail) return;
    setEmails(prev => prev.map(e => e.id === msg.id ? { ...e, isRead: true } : e));
    fetch(`${API}/api/gmail/read`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ email: gmailEmail, messageId: msg.id }),
    }).catch(() => {});
  };

  const toggleStar = (msg: GmailMessage) => {
    setEmails(prev => prev.map(e => e.id === msg.id ? { ...e, isStarred: !e.isStarred } : e));
    if (selected?.id === msg.id) setSelected(s => s ? { ...s, isStarred: !s.isStarred } : null);
  };

  const archiveEmail = async () => {
    if (!selected || !gmailEmail) return;
    setEmails(prev => prev.filter(e => e.id !== selected.id));
    const next = emails.find(e => e.id !== selected.id) || null;
    setSelected(next);
    // showToast('Archived', 'success');
    fetch(`${API}/api/gmail/archive`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ email: gmailEmail, messageId: selected.id }),
    }).catch(() => {});
  };

  const deleteEmail = () => {
    if (!selected) return;
    setEmails(prev => prev.filter(e => e.id !== selected.id));
    setSelected(emails.find(e => e.id !== selected.id) || null);
    setShowReply(false);
    // showToast('Deleted', 'info');
  };

  // ── AI Draft Reply ───────────────────────────────────────────────────────
  const handleAiDraft = async () => {
    if (!selected) return;
    setDraftLoading(true);
    const token = localStorage.getItem('authToken');
    try {
      const res = await fetch(`${API}/api/ama/draft-reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ sender: selected.fromEmail, senderName: selected.from, subject: selected.subject, body: selected.body }),
      });
      const data = await res.json();
      if (res.ok && data.draft) {
        setDraftReply(data.draft);
        // showToast('Draft generated!', 'success');
      } else {
        throw new Error(data.message);
      }
    } catch {
      // showToast('Could not generate draft', 'error');
    } finally {
      setDraftLoading(false);
    }
  };

  const handleSendReply = async () => {
    if (!selected || !draftReply.trim() || !gmailEmail) return;
    setSendingReply(true);
    try {
      const res = await fetch(`${API}/api/gmail/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          email: gmailEmail,
          to: selected.fromEmail,
          subject: selected.subject,
          body: draftReply,
          threadId: selected.threadId,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      // showToast('Reply sent!', 'success');
      setShowReply(false);
      setDraftReply('');
      markRead(selected);
    } catch (err: any) {
      // showToast(err.message || 'Send failed', 'error');
    } finally {
      setSendingReply(false);
    }
  };

  // ── Filter ───────────────────────────────────────────────────────────────
  const filtered = emails
    .filter(e => {
      if (filter === 'unread') return !e.isRead;
      if (filter === 'starred') return e.isStarred;
      return true;
    })
    .filter(e =>
      !search ||
      e.subject.toLowerCase().includes(search.toLowerCase()) ||
      e.from.toLowerCase().includes(search.toLowerCase())
    );

  const unreadCount = emails.filter(e => !e.isRead).length;

  // ── NOT CONNECTED STATE ─────────────────────────────────────────────────
  if (!connected || !gmailEmail) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-slate-50 to-orange-50 p-6">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-10 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-orange-400 to-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-orange-300/40">
            <Mail className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Connect Gmail</h2>
          <p className="text-slate-500 text-sm mb-6">
            Connect your Gmail account to view your real inbox, read emails, and send AI-powered replies — all inside Ama.
          </p>
          <button
            id="connect-gmail-btn"
            onClick={handleConnectGmail}
            className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-white border-2 border-slate-300 hover:border-orange-400 rounded-xl font-medium text-slate-700 hover:text-slate-900 transition-all shadow-sm hover:shadow-md"
          >
            {/* Google G logo */}
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign in with Google
          </button>
          <p className="text-xs text-slate-400 mt-4">
            Only Gmail read/send access is requested. Your data stays private.
          </p>
        </div>
      </div>
    );
  }

  // ── CONNECTED — INBOX VIEW ──────────────────────────────────────────────
  return (
    <div className="flex h-full bg-white overflow-hidden">

      {/* ── Email list panel ── */}
      <div className="w-72 md:w-80 xl:w-96 border-r border-slate-200 flex flex-col flex-shrink-0">

        {/* Connection header */}
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm font-semibold text-slate-800">Gmail Connected</span>
            </div>
            <button
              onClick={handleDisconnect}
              className="text-xs text-slate-400 hover:text-red-500 transition-colors"
              title="Disconnect Gmail"
            >
              Disconnect
            </button>
          </div>
          <p className="text-xs text-slate-500 mb-3 truncate">{gmailEmail}</p>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search emails…"
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 text-sm"
            />
          </div>

          {/* Filters + Sync */}
          <div className="flex items-center gap-2">
            <div className="flex gap-1 flex-1">
              {(['all', 'unread', 'starred'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${
                    filter === f
                      ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f === 'all' && unreadCount > 0 ? `All (${unreadCount})` : f}
                </button>
              ))}
            </div>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              title="Sync now"
            >
              <RefreshCw className={`w-4 h-4 text-slate-600 ${syncing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Message list */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
              <span className="text-sm">Loading inbox…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400 p-6 text-center">
              <Inbox className="w-12 h-12 text-slate-200" />
              <p className="text-sm font-medium">
                {search ? 'No results found' : filter !== 'all' ? `No ${filter} emails` : 'Inbox is empty'}
              </p>
              {!search && (
                <button onClick={handleSync} className="mt-2 text-xs text-orange-500 hover:underline">
                  Sync now
                </button>
              )}
            </div>
          ) : (
            filtered.map(email => (
              <div
                key={email.id}
                onClick={() => {
                  setSelected(email);
                  setShowReply(false);
                  setDraftReply('');
                  markRead(email);
                }}
                className={`p-3 border-b border-slate-100 cursor-pointer transition-colors ${
                  selected?.id === email.id ? 'bg-orange-50 border-l-2 border-l-orange-500' : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start gap-2">
                  {/* Unread dot */}
                  <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${!email.isRead ? 'bg-blue-500' : 'bg-transparent'}`} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className={`text-sm truncate ${!email.isRead ? 'font-bold text-slate-900' : 'font-medium text-slate-600'}`}>
                        {email.from}
                      </span>
                      <span className="text-xs text-slate-400 flex-shrink-0 ml-1">{email.time}</span>
                    </div>
                    <p className={`text-xs mb-1 truncate ${!email.isRead ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>
                      {email.subject}
                    </p>
                    <p className="text-xs text-slate-400 truncate">{email.preview}</p>
                  </div>

                  <button
                    onClick={e => { e.stopPropagation(); toggleStar(email); }}
                    className="flex-shrink-0 mt-1"
                  >
                    <Star className={`w-3.5 h-3.5 ${email.isStarred ? 'fill-yellow-400 text-yellow-400' : 'text-slate-300 hover:text-slate-400'}`} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Email detail pane ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {selected ? (
          <>
            {/* Header + actions */}
            <div className="p-5 border-b border-slate-200 flex-shrink-0">
              <h3 className="text-lg font-semibold text-slate-900 mb-3 break-words">{selected.subject}</h3>
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {selected.from.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 text-sm">{selected.from}</p>
                  <p className="text-xs text-slate-500 break-all">{selected.fromEmail}</p>
                </div>
                <div className="text-right flex-shrink-0 text-xs text-slate-500">
                  <p>{selected.date}</p>
                  <p>{selected.time}</p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2">
                <button
                  id="reply-btn"
                  onClick={() => { setShowReply(true); if (!draftReply) handleAiDraft(); }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg hover:from-amber-600 hover:to-orange-700 text-sm shadow-sm"
                >
                  <Reply className="w-4 h-4" />
                  Reply
                </button>
                <button
                  onClick={archiveEmail}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-sm"
                >
                  <Archive className="w-4 h-4" />
                  Archive
                </button>
                <button
                  onClick={() => toggleStar(selected)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-sm"
                >
                  <Star className={`w-4 h-4 ${selected.isStarred ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                  Star
                </button>
                <button
                  onClick={deleteEmail}
                  className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-sm"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
                {/* Follow-up reminders (client-side toast only) */}
                <button
                  onClick={() => {/* showToast('Follow-up reminder set for 3 days', 'info') */}}
                  className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-sm"
                >
                  <Bell className="w-4 h-4" />
                  +3 days
                </button>
              </div>
            </div>

            {/* Body + reply */}
            <div className="flex-1 overflow-y-auto p-5">
              <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6 text-sm text-slate-800 leading-relaxed whitespace-pre-wrap break-words">
                {selected.body || selected.preview || '(no content)'}
              </div>

              {showReply && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-semibold text-blue-900">Reply to {selected.from}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleAiDraft}
                        disabled={draftLoading}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-blue-300 rounded-lg text-xs text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                      >
                        {draftLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                        {draftLoading ? 'Generating…' : 'AI Draft'}
                      </button>
                      <button onClick={() => { setShowReply(false); setDraftReply(''); }} className="p-1 text-slate-400 hover:text-slate-600">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {draftLoading && !draftReply ? (
                    <div className="flex items-center gap-2 text-slate-500 text-sm py-4">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                      Ama is writing your reply…
                    </div>
                  ) : (
                    <textarea
                      value={draftReply}
                      onChange={e => setDraftReply(e.target.value)}
                      rows={6}
                      placeholder="Write your reply or use AI Draft above…"
                      className="w-full p-3 border border-blue-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none bg-white"
                    />
                  )}

                  <div className="flex gap-2 mt-3">
                    <button
                      id="send-reply-btn"
                      onClick={handleSendReply}
                      disabled={sendingReply || !draftReply.trim()}
                      className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg text-sm hover:from-amber-600 hover:to-orange-700 disabled:opacity-50"
                    >
                      {sendingReply ? <Loader2 className="w-4 h-4 animate-spin" /> : <SendIcon className="w-4 h-4" />}
                      {sendingReply ? 'Sending…' : 'Send Reply'}
                    </button>
                    <button
                      onClick={() => { setShowReply(false); setDraftReply(''); }}
                      className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-slate-400">
              <Inbox className="w-16 h-16 mx-auto mb-3 text-slate-200" />
              <p className="text-sm">Select an email to read</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
