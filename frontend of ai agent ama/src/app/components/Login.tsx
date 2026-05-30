import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, Eye, EyeOff, ShieldCheck, ArrowLeft, KeyRound } from 'lucide-react';
import { API_BASE } from '../utils/config';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [redirectingProvider, setRedirectingProvider] = useState<'google' | 'facebook' | 'linkedin' | null>(null);

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

  const { user, login, verifyEmail, resendVerification, forgotPassword, loginWithProvider } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
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

  const handleSocialLogin = async (provider: 'google' | 'facebook' | 'linkedin') => {
    setError('');
    setRedirectingProvider(provider);
    try {
      const configRes = await fetch(`${API_BASE}/api/auth/config`);
      if (!configRes.ok) throw new Error('Failed to fetch auth configuration');
      const config = await configRes.json();
      
      const redirectUri = encodeURIComponent(`${window.location.origin}/auth/callback/${provider}`);
      let url = '';
      
      if (provider === 'google') {
        url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${config.googleClientId}&redirect_uri=${redirectUri}&response_type=code&scope=${encodeURIComponent('openid email profile https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events')}&access_type=offline&prompt=consent`;
      } else if (provider === 'facebook') {
        url = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${config.facebookAppId}&redirect_uri=${redirectUri}&response_type=code&scope=email,public_profile`;
      } else if (provider === 'linkedin') {
        url = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${config.linkedinClientId}&redirect_uri=${redirectUri}&scope=${encodeURIComponent('openid profile email')}`;
      }
      
      window.location.href = url;
    } catch (err: any) {
      console.error(`${provider} OAuth redirection failed:`, err);
      setError(err.message || `Unable to redirect to ${provider} consent page.`);
      setRedirectingProvider(null);
    }
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
      setResendCooldown(60);
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
        .catch(() => navigate('/dashboard'));
    } else {
      navigate('/dashboard');
    }
  };

  // ── Overlay modals (verification, forgot, gmail prompt) ─────────────────────
  const renderOverlay = () => {
    if (isVerifying) {
      return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full">
            <div className="flex flex-col items-center mb-6">
              <div className="w-14 h-14 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 mb-4">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-slate-800">Verify Your Email</h2>
              <p className="text-slate-500 text-sm mt-2 text-center">
                We sent a 6-digit code to <span className="text-indigo-600 font-medium">{pendingEmail || email}</span>.
              </p>
            </div>
            <form onSubmit={handleVerificationSubmit} className="space-y-4">
              {verificationError && (
                <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl text-sm text-center">{verificationError}</div>
              )}
              <input
                type="text"
                maxLength={6}
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                className="w-full text-center tracking-[0.5em] font-mono text-xl py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              />
              <button type="submit" disabled={loading || verificationCode.length !== 6}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                {loading ? 'Verifying...' : 'Verify & Sign In'}
              </button>
              <div className="text-center">
                <button type="button" onClick={handleResendCode} disabled={resendCooldown > 0}
                  className={`text-sm ${resendCooldown > 0 ? 'text-slate-400 cursor-not-allowed' : 'text-indigo-600 hover:text-indigo-700 font-semibold'}`}>
                  {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend Code'}
                </button>
              </div>
              <button type="button" onClick={() => setIsVerifying(false)}
                className="w-full flex items-center justify-center gap-1 text-xs text-slate-400 hover:text-slate-600">
                <ArrowLeft className="w-3 h-3" /> Back to Login
              </button>
            </form>
          </div>
        </div>
      );
    }
    if (forgotMode) {
      return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full">
            <div className="flex flex-col items-center mb-6">
              <div className="w-14 h-14 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 mb-4">
                <KeyRound className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-slate-800">Forgot Password</h2>
              <p className="text-slate-500 text-sm mt-1 text-center">Enter your email to receive a reset link.</p>
            </div>
            {forgotSuccess ? (
              <div className="space-y-4 text-center">
                <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-xl text-sm">
                  Reset link sent! Check your inbox.
                </div>
                <button onClick={() => { setForgotMode(false); setForgotSuccess(false); }}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all">
                  Return to Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} className="space-y-4">
                {error && <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl text-sm text-center">{error}</div>}
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm" required />
                </div>
                <button type="submit" disabled={loading || !forgotEmail}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all disabled:opacity-50">
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
                <button type="button" onClick={() => setForgotMode(false)}
                  className="w-full flex items-center justify-center gap-1 text-xs text-slate-400 hover:text-slate-600">
                  <ArrowLeft className="w-3 h-3" /> Back to Sign In
                </button>
              </form>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-indigo-50 flex items-center justify-center p-4 font-sans">
      {renderOverlay()}

      {/* Main Card */}
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden flex min-h-[580px]">

        {/* ── LEFT: Form Panel ─────────────────────────────── */}
        <div className="flex-1 flex flex-col justify-center px-10 py-12">
          <div className="max-w-sm mx-auto w-full">
            <h1 className="text-3xl font-extrabold text-slate-800 mb-1 tracking-tight">Sign In</h1>
            <p className="text-sm text-slate-500 mb-6">Welcome back! Please sign in to continue.</p>

            {/* Social Buttons */}
            {redirectingProvider ? (
              <div className="flex flex-col items-center justify-center py-2.5 space-y-2 mb-4 bg-slate-50 border border-slate-100 rounded-xl">
                <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-xs font-semibold text-slate-600 animate-pulse">
                  {redirectingProvider === 'google' && 'Redirecting to Google...'}
                  {redirectingProvider === 'facebook' && 'Redirecting to Facebook...'}
                  {redirectingProvider === 'linkedin' && 'Redirecting to LinkedIn...'}
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-4 mb-5">
                {/* Facebook */}
                <button type="button" title="Sign in with Facebook" onClick={() => handleSocialLogin('facebook')} disabled={!!redirectingProvider}
                  className="w-11 h-11 rounded-full border-2 border-slate-200 hover:border-indigo-400 flex items-center justify-center text-slate-600 hover:text-indigo-600 transition-all font-bold text-sm disabled:opacity-50">
                  f
                </button>
                {/* Google */}
                <button type="button" title="Sign in with Google" onClick={() => handleSocialLogin('google')} disabled={!!redirectingProvider}
                  className="w-11 h-11 rounded-full border-2 border-slate-200 hover:border-red-400 flex items-center justify-center font-bold text-sm transition-all disabled:opacity-50">
                  <svg viewBox="0 0 24 24" className="w-5 h-5">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                </button>
                {/* LinkedIn */}
                <button type="button" title="Sign in with LinkedIn" onClick={() => handleSocialLogin('linkedin')} disabled={!!redirectingProvider}
                  className="w-11 h-11 rounded-full border-2 border-slate-200 hover:border-blue-500 flex items-center justify-center text-slate-600 hover:text-blue-600 transition-all font-bold text-xs disabled:opacity-50">
                  in
                </button>
              </div>
            )}

            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-xs text-slate-400 font-medium">or use your account</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl text-sm text-center">{error}</div>
              )}

              {/* Email */}
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email Address"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm transition-all"
                  required />
              </div>

              {/* Password */}
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm transition-all"
                  required />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <div className="text-right">
                <button type="button" onClick={() => setForgotMode(true)}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold">
                  Forgot your password?
                </button>
              </div>

              <button type="submit" disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-full font-bold tracking-widest text-sm transition-all shadow-lg shadow-indigo-500/25 disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98]">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin" />
                    Signing in...
                  </span>
                ) : 'SIGN IN'}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-500 md:hidden">
              Don't have an account?{' '}
              <Link to="/register" className="text-indigo-600 hover:text-indigo-700 font-semibold">Sign Up</Link>
            </p>
          </div>
        </div>

        {/* ── RIGHT: Accent Panel (hidden on mobile) ───────── */}
        <div className="hidden md:flex w-80 flex-col items-center justify-center bg-gradient-to-br from-indigo-600 via-indigo-700 to-blue-800 px-10 py-12 text-white text-center relative overflow-hidden">
          {/* Background circles for depth */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

          <div className="relative z-10">
            <h2 className="text-3xl font-extrabold mb-4 tracking-tight">Hello,<br />Friend!</h2>
            <p className="text-sm text-indigo-100 leading-relaxed mb-8">
              Enter your personal details and start your journey with us today.
            </p>
            <Link to="/register"
              className="inline-block px-10 py-3 border-2 border-white text-white rounded-full font-bold tracking-widest text-sm hover:bg-white hover:text-indigo-700 transition-all duration-200">
              SIGN UP
            </Link>
          </div>
        </div>
      </div>

      {/* Gmail Permission Prompt Modal */}
      {showGmailPrompt && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                <Mail className="w-7 h-7" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-center text-slate-800 mb-2">Connect Gmail?</h2>
            <p className="text-center text-slate-500 text-sm mb-6 leading-relaxed">
              Would you like to give Ryve access to read and manage your Gmail inbox directly within the app?
              <br /><br />
              <span className="text-xs text-slate-400">You will be redirected to Google to grant permission.</span>
            </p>
            <div className="flex gap-3">
              <button onClick={() => navigate('/dashboard')}
                className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition font-bold text-sm">
                Skip for now
              </button>
              <button onClick={handleConnectGmail} disabled={connectingGmail}
                className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition font-bold text-sm disabled:opacity-60">
                {connectingGmail ? 'Redirecting…' : 'Yes, Connect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
