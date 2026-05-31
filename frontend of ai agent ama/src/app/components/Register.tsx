import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, User, Eye, EyeOff, ShieldCheck, ArrowLeft, Check, X } from 'lucide-react';
import { API_BASE } from '../utils/config';

export default function Register() {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [redirectingProvider, setRedirectingProvider] = useState<'google' | 'facebook' | 'linkedin' | null>(null);

  // Gmail prompt state
  const [showGmailPrompt, setShowGmailPrompt] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [connectingGmail, setConnectingGmail] = useState(false);

  // Email verification state
  const [isVerifying, setIsVerifying] = useState(false);
  const [isAwaitingVerification, setIsAwaitingVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [verificationError, setVerificationError] = useState('');

  const { user, register, verifyEmail, resendVerification, loginWithProvider } = useAuth();
  const navigate = useNavigate();

  // Password criteria
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  const passwordsMatch = password === confirmPassword && password !== '';
  const isPasswordValid = hasMinLength && hasUppercase && hasNumber && hasSpecialChar;

  const step1Valid = name.trim() && email.trim() && email.includes('@');
  const step2Valid = isPasswordValid && passwordsMatch && agreedToTerms;

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
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

  const handleConnectGmail = () => { window.location.href = `${API_BASE}/auth/gmail`; };

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

  const handleStep1Next = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!step1Valid) { setError('Please fill in your name and a valid email.'); return; }
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!step2Valid) return;
    setLoading(true);
    const result = await register(name, email, password);
    if (result.success) {
      setLoading(false);
      setPendingEmail(email);
      setIsAwaitingVerification(true);
    } else if (result.unverified) {
      setLoading(false);
      setPendingEmail(email);
      setIsAwaitingVerification(true);
    } else {
      setLoading(false);
      setError(result.error || 'Registration failed.');
    }
  };

  const handleVerificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerificationError('');
    setLoading(true);
    if (verificationCode.length !== 6) {
      setVerificationError('Code must be exactly 6 digits.');
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
      setVerificationError(result.error || 'Invalid or expired code.');
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0) return;
    setVerificationError('');
    const res = await resendVerification(pendingEmail || email);
    if (res.success) setResendCooldown(60);
    else setVerificationError(res.error || 'Failed to resend.');
  };

  const handlePostLoginRedirect = (userEmail: string) => {
    if (userEmail && userEmail.toLowerCase().endsWith('@gmail.com')) {
      const token = localStorage.getItem('authToken');
      fetch(`${API_BASE}/api/gmail/status?email=${encodeURIComponent(userEmail)}`, {
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      })
        .then(async (statusRes) => {
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            if (!statusData.connected) { setPendingEmail(userEmail); setShowGmailPrompt(true); return; }
          }
          navigate('/dashboard');
        })
        .catch(() => navigate('/dashboard'));
    } else {
      navigate('/dashboard');
    }
  };

  const CriteriaRow = ({ met, label }: { met: boolean; label: string }) => (
    <div className="flex items-center gap-2">
      {met ? <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" /> : <X className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />}
      <span className={`text-xs ${met ? 'text-green-600' : 'text-slate-400'}`}>{label}</span>
    </div>
  );

  const renderOverlay = () => {
    if (isVerifying) {
      return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full">
            <div className="flex flex-col items-center mb-6">
              <div className="w-14 h-14 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 mb-4"><ShieldCheck className="w-8 h-8" /></div>
              <h2 className="text-xl font-bold text-slate-800">Verify Your Email</h2>
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mt-4 mb-2">
                <p className="text-indigo-900 font-semibold text-sm mb-1">Check your inbox</p>
                <p className="text-indigo-700 text-xs leading-relaxed">
                  We sent a 6-digit code to <span className="font-bold">{pendingEmail || email}</span>. 
                  It may take 1-2 minutes to arrive. Please check your spam or junk folder if you don't see it.
                </p>
              </div>
            </div>
            <form onSubmit={handleVerificationSubmit} className="space-y-4">
              {verificationError && <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl text-sm text-center">{verificationError}</div>}
              <input type="text" maxLength={6} value={verificationCode} onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456" className="w-full text-center tracking-[0.5em] font-mono text-xl py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
              <button type="submit" disabled={loading || verificationCode.length !== 6}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all disabled:opacity-50">
                {loading ? 'Verifying...' : 'Verify & Sign In'}
              </button>
              <div className="text-center">
                <button type="button" onClick={handleResendCode} disabled={resendCooldown > 0}
                  className={`text-sm ${resendCooldown > 0 ? 'text-slate-400 cursor-not-allowed' : 'text-indigo-600 font-semibold'}`}>
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                </button>
              </div>
              <button type="button" onClick={() => setIsVerifying(false)}
                className="w-full flex items-center justify-center gap-1 text-xs text-slate-400 hover:text-slate-600">
                <ArrowLeft className="w-3 h-3" /> Back to Register
              </button>
            </form>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-indigo-50 flex items-center justify-center p-4 font-sans">
      {renderOverlay()}

      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden flex min-h-[580px]">

        {/* ── LEFT: Accent Panel (hidden on mobile) ─── */}
        <div className="hidden md:flex w-80 flex-col items-center justify-center bg-gradient-to-br from-indigo-600 via-indigo-700 to-blue-800 px-10 py-12 text-white text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
          <div className="relative z-10">
            <h2 className="text-3xl font-extrabold mb-4 tracking-tight">Welcome<br />Back!</h2>
            <p className="text-sm text-indigo-100 leading-relaxed mb-8">
              Already have an account? Sign in to continue your journey with us.
            </p>
            <Link to="/login"
              className="inline-block px-10 py-3 border-2 border-white text-white rounded-full font-bold tracking-widest text-sm hover:bg-white hover:text-indigo-700 transition-all duration-200">
              SIGN IN
            </Link>
          </div>
        </div>

        {/* ── RIGHT: Form Panel ──────────────────────── */}
        <div className="flex-1 flex flex-col justify-center px-10 py-12">
          <div className="max-w-sm mx-auto w-full">
            {isAwaitingVerification ? (
              <div className="space-y-6 animate-fade-in">
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-600 mb-4 shadow-md shadow-orange-100/40">
                    <Mail className="w-8 h-8" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-800 tracking-tight font-sans">Verify your email</h2>
                  <p className="text-xs text-slate-500 mt-2">
                    We sent a verification link to:
                  </p>
                  <p className="text-sm font-semibold text-slate-700 mt-1 break-all bg-indigo-50/50 px-4 py-2.5 rounded-xl border border-indigo-100/50">
                    {pendingEmail || email}
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                  <div className="flex gap-3">
                    <span className="text-lg">✉️</span>
                    <div>
                      <p className="text-xs font-bold text-slate-800">Check your Inbox</p>
                      <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                        Look for an email sent from <span className="font-mono bg-slate-100 px-1 rounded text-orange-600 font-semibold">noreply@[project].firebaseapp.com</span>.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <span className="text-lg">📂</span>
                    <div>
                      <p className="text-xs font-bold text-slate-800">Spam & Promotions</p>
                      <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                        Sometimes notifications land in the **Spam** folder or **Promotions** tab. Mark it as "Not Spam" for future delivery.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <span className="text-lg">⏱️</span>
                    <div>
                      <p className="text-xs font-bold text-slate-800">Delivery Time</p>
                      <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                        Verification emails are dispatched instantly but may take 2-5 minutes depending on your email provider.
                      </p>
                    </div>
                  </div>
                </div>

                {verificationError && (
                  <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl text-xs text-center font-medium">
                    {verificationError}
                  </div>
                )}

                <div className="space-y-3 pt-2">
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={resendCooldown > 0}
                    className="w-full py-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-full font-bold tracking-widest text-[11px] transition-all shadow-lg shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {resendCooldown > 0 ? (
                      `RESEND IN ${resendCooldown}S`
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        RESEND VERIFICATION LINK
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePostLoginRedirect(pendingEmail || email)}
                    className="w-full py-3 bg-white border-2 border-slate-200 hover:border-slate-300 text-slate-700 rounded-full font-bold tracking-widest text-[11px] transition-all flex items-center justify-center gap-1.5"
                  >
                    CONTINUE TO DASHBOARD
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsAwaitingVerification(false);
                      setStep(1);
                    }}
                    className="w-full text-[11px] text-slate-400 hover:text-slate-600 transition-colors font-semibold text-center block pt-1"
                  >
                    Change email address
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Create Account</h1>
                </div>

                {/* Step indicator */}
                <div className="flex items-center gap-2 mb-6">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    step >= 1 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-400'
                  }`}>1</div>
                  <div className={`flex-1 h-0.5 transition-all ${step >= 2 ? 'bg-indigo-600' : 'bg-slate-200'}`} />
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    step >= 2 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'
                  }`}>2</div>
                  <span className="text-xs text-slate-400 ml-1">Step {step} of 2</span>
                </div>

                {step === 1 ? (
                  <form onSubmit={handleStep1Next} className="space-y-4">
                    {error && <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl text-sm text-center">{error}</div>}

                    {/* Social row */}
                    {redirectingProvider ? (
                      <div className="flex flex-col items-center justify-center py-2.5 space-y-2 mb-2 bg-slate-50 border border-slate-100 rounded-xl">
                        <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-xs font-semibold text-slate-600 animate-pulse">
                          {redirectingProvider === 'google' && 'Redirecting to Google...'}
                          {redirectingProvider === 'facebook' && 'Redirecting to Facebook...'}
                          {redirectingProvider === 'linkedin' && 'Redirecting to LinkedIn...'}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-4 mb-2">
                        <button type="button" title="Continue with Facebook" onClick={() => handleSocialLogin('facebook')} disabled={!!redirectingProvider}
                          className="w-11 h-11 rounded-full border-2 border-slate-200 hover:border-indigo-400 flex items-center justify-center text-slate-600 font-bold text-sm transition-all disabled:opacity-50">f</button>
                        <button type="button" title="Continue with Google" onClick={() => handleSocialLogin('google')} disabled={!!redirectingProvider}
                          className="w-11 h-11 rounded-full border-2 border-slate-200 hover:border-red-400 flex items-center justify-center font-bold text-sm transition-all disabled:opacity-50">
                          <svg viewBox="0 0 24 24" className="w-5 h-5">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                          </svg>
                        </button>
                        <button type="button" title="Continue with LinkedIn" onClick={() => handleSocialLogin('linkedin')} disabled={!!redirectingProvider}
                          className="w-11 h-11 rounded-full border-2 border-slate-200 hover:border-blue-500 flex items-center justify-center text-slate-600 font-bold text-xs transition-all disabled:opacity-50">in</button>
                      </div>
                    )}

                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-px bg-slate-200" />
                      <span className="text-xs text-slate-400">or use your email for registration</span>
                      <div className="flex-1 h-px bg-slate-200" />
                    </div>

                    {/* Name */}
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full Name"
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm" required />
                    </div>

                    {/* Email */}
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Work Email"
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm" required />
                    </div>

                    {/* Company (optional) */}
                    <div className="relative">
                      <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company Name (optional)"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm" />
                    </div>

                    {/* Role */}
                    <select value={role} onChange={(e) => setRole(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm">
                      <option value="">Your Role (optional)</option>
                      <option value="CEO">CEO</option>
                      <option value="Owner">Owner</option>
                      <option value="Executive">Executive</option>
                      <option value="Manager">Manager</option>
                      <option value="Other">Other</option>
                    </select>

                    <button type="submit"
                      className="w-full py-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-full font-bold tracking-widest text-sm transition-all shadow-lg shadow-indigo-500/25 active:scale-[0.98]">
                      CONTINUE
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {error && <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl text-sm text-center">{error}</div>}

                    {/* Password */}
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password"
                        className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm" required />
                      <button type="button" onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* Confirm Password */}
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm Password"
                        className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm" required />
                      <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* Password criteria */}
                    {password.length > 0 && (
                      <div className="bg-slate-50 rounded-xl p-3 space-y-1.5">
                        <CriteriaRow met={hasMinLength} label="At least 8 characters" />
                        <CriteriaRow met={hasUppercase} label="One uppercase letter" />
                        <CriteriaRow met={hasNumber} label="One number" />
                        <CriteriaRow met={hasSpecialChar} label="One special character" />
                        <CriteriaRow met={passwordsMatch} label="Passwords match" />
                      </div>
                    )}

                    {/* Terms */}
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input type="checkbox" checked={agreedToTerms} onChange={(e) => setAgreedToTerms(e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                      <span className="text-xs text-slate-500 leading-relaxed">
                        I agree to the <span className="text-indigo-600 font-semibold cursor-pointer hover:underline">Terms of Service</span> and <span className="text-indigo-600 font-semibold cursor-pointer hover:underline">Privacy Policy</span>
                      </span>
                    </label>

                    <div className="flex gap-2">
                      <button type="button" onClick={() => setStep(1)}
                        className="px-4 py-3 border-2 border-slate-200 text-slate-600 rounded-full font-bold text-sm hover:border-slate-300 transition-all">
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                      <button type="submit" disabled={!step2Valid || loading}
                        className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-full font-bold tracking-widest text-sm transition-all shadow-lg shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]">
                        {loading ? (
                          <span className="flex items-center justify-center gap-2">
                            <div className="w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin" />
                            Creating...
                          </span>
                        ) : 'CREATE ACCOUNT'}
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}

            <p className="mt-6 text-center text-sm text-slate-500 md:hidden">
              Already have an account?{' '}
              <Link to="/login" className="text-indigo-600 hover:text-indigo-700 font-semibold">Sign In</Link>
            </p>
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
              Would you like to give Ryve access to read and manage your Gmail inbox?<br /><br />
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
