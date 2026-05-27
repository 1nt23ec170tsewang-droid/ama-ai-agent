import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, LogIn, Eye, EyeOff, ShieldCheck, ArrowLeft, KeyRound } from 'lucide-react';
import RyveLogo from './RyveLogo';
import { motion } from 'motion/react';
import { API_BASE } from '../utils/config';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Gmail prompt state
  const [showGmailPrompt, setShowGmailPrompt] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [connectingGmail, setConnectingGmail] = useState(false);

  // Email verification state
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [verificationError, setVerificationError] = useState('');

  // Forgot password state
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);

  const { login, verifyEmail, resendVerification, forgotPassword } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Pre-warm backend cold start on mount
    fetch(`${API_BASE}/health`).catch(() => {});
  }, []);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleConnectGmail = () => {
    window.location.href = `${API_BASE}/auth/gmail`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!email || !password) {
      setError('Please fill in all fields');
      setLoading(false);
      return;
    }

    const result = await login(email, password);
    if (result.success) {
      setLoading(false);
      handlePostLoginRedirect(email);
    } else if (result.unverified) {
      setLoading(false);
      setPendingEmail(email);
      setIsVerifying(true);
    } else {
      setLoading(false);
      setError(result.error || 'Invalid email or password');
    }
  };

  const handleVerificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerificationError('');
    setLoading(true);

    if (verificationCode.length !== 6) {
      setVerificationError('Verification code must be exactly 6 digits.');
      setLoading(false);
      return;
    }

    const result = await verifyEmail(pendingEmail || email, verificationCode);
    if (result.success) {
      setLoading(false);
      setIsVerifying(false);
      handlePostLoginRedirect(pendingEmail || email);
    } else {
      setLoading(false);
      setVerificationError(result.error || 'Invalid or expired verification code.');
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0) return;
    setVerificationError('');
    const targetEmail = pendingEmail || email;
    const res = await resendVerification(targetEmail);
    if (res.success) {
      setResendCooldown(60); // 60 seconds rate limit
    } else {
      setVerificationError(res.error || 'Failed to resend verification code.');
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!forgotEmail) {
      setError('Email is required.');
      setLoading(false);
      return;
    }

    const res = await forgotPassword(forgotEmail);
    if (res.success) {
      setForgotSuccess(true);
    } else {
      setError(res.error || 'Failed to send password reset email.');
    }
    setLoading(false);
  };

  const handlePostLoginRedirect = (userEmail: string) => {
    if (userEmail.toLowerCase().endsWith('@gmail.com')) {
      const token = localStorage.getItem('authToken');
      fetch(`${API_BASE}/api/gmail/status?email=${encodeURIComponent(userEmail)}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
      })
        .then(async (statusRes) => {
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            if (!statusData.connected) {
              setPendingEmail(userEmail);
              setShowGmailPrompt(true);
              return;
            }
          }
          navigate('/dashboard');
        })
        .catch(() => {
          navigate('/dashboard');
        });
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-[#030014] text-white flex items-center justify-center font-sans relative overflow-hidden px-4">
      {/* Premium Background Gradients */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-950/20 via-slate-900 to-[#030014] z-0"></div>
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl z-0"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl z-0"></div>


      <div className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 z-10 shadow-2xl transition-all duration-300 hover:border-white/15">
        
        {/* VIEW 1: Email Verification Mode */}
        {isVerifying ? (
          <div>
            <div className="flex flex-col items-center mb-6">
              <div className="w-14 h-14 bg-orange-500/10 border border-orange-500/30 rounded-xl flex items-center justify-center text-orange-400 mb-4 shadow-lg shadow-orange-500/10">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-slate-400">
                Verify Your Email
              </h2>
              <p className="text-slate-400 text-sm mt-2 text-center">
                We've sent a 6-digit confirmation code to <span className="text-orange-400 font-medium">{pendingEmail || email}</span>.
              </p>
            </div>

            <form onSubmit={handleVerificationSubmit} className="space-y-5">
              {verificationError && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 p-3 rounded-xl text-sm text-center">
                  {verificationError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 tracking-wide uppercase">
                  6-Digit Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="w-full text-center tracking-[0.5em] font-mono text-xl py-3 bg-black/30 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/20 transition-all"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading || verificationCode.length !== 6}
                className={`w-full py-3 rounded-xl text-sm font-bold tracking-wide transition-all duration-300 flex items-center justify-center space-x-2 ${
                  loading || verificationCode.length !== 6
                    ? 'bg-slate-800 text-slate-500 border border-white/5 cursor-not-allowed'
                    : 'bg-orange-600 hover:bg-orange-500 text-white hover:shadow-orange-500/20 active:scale-[0.98]'
                }`}
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin"></div>
                ) : (
                  'Verify & Sign In'
                )}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={resendCooldown > 0}
                  className={`text-sm ${
                    resendCooldown > 0
                      ? 'text-slate-500 cursor-not-allowed font-medium'
                      : 'text-orange-400 hover:text-orange-300 font-semibold'
                  }`}
                >
                  {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend Code'}
                </button>
              </div>

              <div className="text-center pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setIsVerifying(false)}
                  className="inline-flex items-center text-xs font-semibold text-slate-400 hover:text-slate-200 space-x-1"
                >
                  <ArrowLeft className="w-3 h-3" />
                  <span>Back to Login</span>
                </button>
              </div>
            </form>
          </div>
        ) : forgotMode ? (
          /* VIEW 2: Forgot Password Mode */
          <div>
            <div className="flex flex-col items-center mb-6">
              <div className="w-14 h-14 bg-indigo-500/10 border border-indigo-500/30 rounded-xl flex items-center justify-center text-indigo-400 mb-4 shadow-lg shadow-indigo-500/10">
                <KeyRound className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-slate-400">
                Forgot Password
              </h2>
              <p className="text-slate-400 text-sm mt-1 text-center">
                Enter your email address to receive a secure password reset link.
              </p>
            </div>

            {forgotSuccess ? (
              <div className="space-y-5 text-center">
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 p-4 rounded-xl text-sm">
                  We've sent a secure reset link to your email address. It will expire in 15 minutes.
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setForgotMode(false);
                    setForgotSuccess(false);
                  }}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold tracking-wide transition-all"
                >
                  Return to Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} className="space-y-5">
                {error && (
                  <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 p-3 rounded-xl text-sm text-center">
                    {error}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 tracking-wide uppercase">
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full pl-10 pr-4 py-2.5 bg-black/30 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all text-sm"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !forgotEmail}
                  className={`w-full py-2.5 rounded-xl text-sm font-bold tracking-wide transition-all duration-300 flex items-center justify-center space-x-2 ${
                    loading || !forgotEmail
                      ? 'bg-slate-800 text-slate-500 border border-white/5 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white hover:shadow-indigo-500/20 active:scale-[0.98]'
                  }`}
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin"></div>
                  ) : (
                    'Send Reset Link'
                  )}
                </button>

                <div className="text-center pt-4 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => setForgotMode(false)}
                    className="inline-flex items-center text-xs font-semibold text-slate-400 hover:text-slate-200 space-x-1"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    <span>Back to Sign In</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : (
          /* VIEW 3: Standard Login Mode */
          <div>
            <div className="text-center mb-6">
              <div className="mb-3">
                <RyveLogo size={64} variant="dark" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-slate-400">
                Welcome Back
              </h1>
              <p className="text-slate-400 text-sm mt-1">
                Sign in to Ryve
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 p-3 rounded-xl text-sm text-center">
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 tracking-wide uppercase">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-black/30 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/20 transition-all text-sm"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-slate-300 tracking-wide uppercase">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setForgotMode(true)}
                    className="text-xs font-semibold text-orange-400 hover:text-orange-300"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2.5 bg-black/30 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/20 transition-all text-sm"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-sm font-bold tracking-wide transition-all duration-300 flex items-center justify-center space-x-2 shadow-lg shadow-orange-600/10 hover:shadow-orange-500/20 active:scale-[0.98]"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin"></div>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>

            <div className="mt-6 text-center text-sm">
              <p className="text-slate-400">
                Don't have an account?{' '}
                <Link to="/register" className="text-orange-400 hover:text-orange-300 font-semibold">
                  Create one
                </Link>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Gmail Permission Prompt Modal */}
      {showGmailPrompt && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl shadow-2xl p-8 max-w-md w-full">
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 bg-indigo-500/10 border border-indigo-500/30 rounded-xl flex items-center justify-center text-indigo-400">
                <Mail className="w-7 h-7" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-center text-white mb-2">Connect Gmail?</h2>
            <p className="text-center text-slate-400 text-sm mb-6 leading-relaxed">
              Would you like to give Ryve access to read and manage your Gmail inbox directly within the app? 
              <br/><br/>
              <span className="text-xs text-slate-500 font-medium">You will be redirected to Google to grant permission.</span>
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => navigate('/dashboard')}
                className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 text-slate-300 rounded-xl hover:bg-white/10 transition font-bold text-sm"
              >
                Skip for now
              </button>
              <button
                onClick={handleConnectGmail}
                disabled={connectingGmail}
                className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 transition font-bold text-sm shadow-md shadow-indigo-600/20 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {connectingGmail ? 'Redirecting…' : 'Yes, Connect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
