import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Brain, MessageSquare, CheckSquare, Calendar, Mail,
  Users, BarChart3, Sun, Zap, Shield, Globe, ArrowRight,
  Star, Menu, X, Sparkles, ChevronRight
} from 'lucide-react';

const features = [
  {
    icon: MessageSquare,
    title: 'AI Assistant',
    color: 'from-amber-500 to-orange-600',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    description: 'Chat with your personal AI Chief of Staff. Ask questions, get summaries, brainstorm ideas — all with full context awareness of your work.',
  },
  {
    icon: CheckSquare,
    title: 'Task Tracker',
    color: 'from-blue-500 to-blue-600',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    description: 'AI-powered task management with priorities, due dates, and smart scheduling. Never miss a deadline again.',
  },
  {
    icon: Calendar,
    title: 'Smart Calendar',
    color: 'from-purple-500 to-purple-600',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
    description: 'Manage your schedule effortlessly. Ama can schedule meetings, set reminders, and optimize your calendar automatically.',
  },
  {
    icon: Mail,
    title: 'Email Manager',
    color: 'from-red-500 to-red-600',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    description: 'Connect your Gmail inbox and let Ama read, summarize, and draft intelligent replies to your emails in seconds.',
  },
  {
    icon: Users,
    title: 'Team Manager',
    color: 'from-green-500 to-green-600',
    bg: 'bg-green-500/10',
    border: 'border-green-500/20',
    description: 'Monitor team performance, workload distribution, and KPIs in real time. Keep everyone aligned and productive.',
  },
  {
    icon: BarChart3,
    title: 'Analytics & Insights',
    color: 'from-cyan-500 to-cyan-600',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/20',
    description: 'Weekly reports and productivity insights that help you understand trends and make data-driven decisions.',
  },
  {
    icon: Sun,
    title: 'Morning Briefing',
    color: 'from-yellow-500 to-amber-500',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/20',
    description: "Start every day with a personalized briefing: your tasks, meetings, emails, and team updates — all in one glance.",
  },
  {
    icon: Globe,
    title: 'Integrations',
    color: 'from-orange-500 to-orange-600',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/20',
    description: 'Connect Gmail, Google Calendar, Slack, and WhatsApp. Ama brings all your tools into a single intelligent workspace.',
  },
];

const stats = [
  { value: '8+', label: 'AI-Powered Tools' },
  { value: '24/7', label: 'Always Available' },
  { value: '100%', label: 'Private & Secure' },
  { value: '1', label: 'AI Chief of Staff' },
];

const testimonials = [
  {
    quote: "Ama has transformed how I manage my day. The morning briefing alone saves me 30 minutes every morning.",
    name: "Sarah K.",
    role: "VP of Operations",
    avatar: "SK"
  },
  {
    quote: "Having an AI that understands context across tasks, emails, and meetings is a game changer for productivity.",
    name: "Marcus T.",
    role: "Startup Founder",
    avatar: "MT"
  },
  {
    quote: "The team manager feature gives me real-time visibility without micromanaging. Absolutely brilliant.",
    name: "Priya R.",
    role: "Engineering Manager",
    avatar: "PR"
  },
];

// ── Mobile-only customized landing page ────────────────────────────────────
function MobileLandingPage() {
  const mobileFeatures = [
    { icon: MessageSquare, title: 'AI Chat',    color: 'from-amber-500 to-orange-600',   desc: 'Chat with your AI Chief of Staff anytime.' },
    { icon: CheckSquare,   title: 'Tasks',      color: 'from-blue-500 to-blue-600',      desc: 'Smart task management with AI priorities.' },
    { icon: Mail,          title: 'Email',      color: 'from-red-500 to-red-600',        desc: 'Read & reply to Gmail with AI drafts.' },
    { icon: Calendar,      title: 'Calendar',   color: 'from-purple-500 to-purple-600',  desc: 'Schedule & optimize your calendar.' },
    { icon: Users,         title: 'Team',       color: 'from-green-500 to-green-600',    desc: 'Monitor team KPIs in real time.' },
    { icon: Sun,           title: 'Briefing',   color: 'from-yellow-500 to-amber-500',   desc: 'Start every morning fully prepared.' },
  ];

  return (
    <div className="min-h-screen bg-[#030014] text-white font-sans flex flex-col relative overflow-x-hidden">
      {/* Ambient glows */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute -top-32 -left-32 w-72 h-72 bg-amber-600/12 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -right-32 w-64 h-64 bg-orange-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-56 h-56 bg-amber-500/8 rounded-full blur-3xl" />
      </div>

      {/* ── Top bar ── */}
      <nav className="relative z-20 flex items-center justify-between px-5 py-4 bg-[#030014]/80 backdrop-blur-xl border-b border-white/5 sticky top-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/30">
            <Brain className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="text-base font-bold bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">Ama</span>
            <p className="text-[9px] text-slate-500 leading-none">Chief of Staff Agent</p>
          </div>
        </div>
        <Link
          to="/login"
          className="px-4 py-1.5 text-xs font-semibold text-slate-300 border border-white/10 rounded-lg hover:bg-white/5 transition-colors"
        >
          Sign In
        </Link>
      </nav>

      {/* ── Hero ── */}
      <section className="relative z-10 flex flex-col items-center text-center px-6 pt-12 pb-8">
        {/* Animated badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-amber-500/25 bg-amber-500/8 text-amber-400 text-[11px] font-semibold mb-5 backdrop-blur-sm">
          <Sparkles className="w-3 h-3" />
          Your AI-Powered Chief of Staff
        </div>

        {/* Glow logo */}
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/40 to-orange-600/40 rounded-3xl blur-2xl scale-150" />
          <div className="relative w-24 h-24 bg-gradient-to-br from-amber-500 to-orange-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-orange-500/40">
            <Brain className="w-12 h-12 text-white" />
          </div>
        </div>

        <h1 className="text-4xl font-extrabold tracking-tight mb-3 leading-tight">
          Meet{' '}
          <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 bg-clip-text text-transparent">Ama</span>
        </h1>
        <p className="text-[15px] text-slate-300 font-medium mb-2">Your Executive AI Partner</p>
        <p className="text-sm text-slate-500 leading-relaxed max-w-xs mx-auto mb-8">
          Manages your tasks, emails, calendar &amp; team — so you can focus on what truly matters.
        </p>

        {/* Primary CTAs */}
        <div className="w-full max-w-xs space-y-3">
          <Link
            to="/register"
            id="mobile-hero-register-btn"
            className="flex items-center justify-center gap-2 w-full py-4 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold rounded-2xl transition-all shadow-xl shadow-orange-500/30 active:scale-[0.97] text-[15px]"
          >
            Get Started — It&apos;s Free
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            to="/login"
            id="mobile-hero-login-btn"
            className="flex items-center justify-center gap-2 w-full py-3.5 border border-white/12 bg-white/5 text-slate-200 font-semibold rounded-2xl transition-all active:scale-[0.97] text-[14px]"
          >
            Sign In to Dashboard
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        <p className="mt-4 text-[11px] text-slate-600">📱 Install directly from your browser as an app</p>
      </section>

      {/* ── Stats strip ── */}
      <section className="relative z-10 px-5 py-6">
        <div className="grid grid-cols-4 gap-2">
          {stats.map((s, i) => (
            <div key={i} className="text-center p-3 bg-white/3 border border-white/5 rounded-xl">
              <p className="text-lg font-bold bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">{s.value}</p>
              <p className="text-[9px] text-slate-500 mt-0.5 leading-tight">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features grid ── */}
      <section className="relative z-10 px-5 py-6">
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-white mb-1">Everything You Need</h2>
          <p className="text-xs text-slate-500">8 AI tools working in harmony</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {mobileFeatures.map((f, i) => {
            const Icon = f.icon;
            return (
              <div key={i} className="p-4 bg-white/3 border border-white/6 rounded-2xl hover:border-amber-500/20 transition-all active:scale-[0.97]">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-3 shadow-md`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-sm font-bold text-white mb-1">{f.title}</h3>
                <p className="text-[11px] text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="relative z-10 px-5 py-8 bg-white/2 border-y border-white/5">
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-white mb-1">
            Up &amp; Running in{' '}
            <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">60s</span>
          </h2>
          <p className="text-xs text-slate-500">No complex setup required</p>
        </div>
        <div className="space-y-4">
          {[
            { step: '01', title: 'Create your account', desc: 'Sign up in seconds — no credit card needed.', icon: Shield },
            { step: '02', title: 'Connect your tools',  desc: 'Link Gmail, Calendar & more with one tap.',  icon: Globe },
            { step: '03', title: 'Let Ama work for you', desc: 'Chat, delegate tasks, and stay in control.', icon: Zap },
          ].map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={i} className="flex items-start gap-4 p-4 bg-white/3 border border-white/5 rounded-2xl">
                <div className="relative flex-shrink-0">
                  <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-md shadow-orange-500/20">
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-slate-800 border border-white/10 rounded-full flex items-center justify-center">
                    <span className="text-[9px] font-bold text-amber-400">{s.step}</span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-white mb-0.5">{s.title}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="relative z-10 px-5 py-8">
        <div className="text-center mb-5">
          <h2 className="text-xl font-bold text-white mb-1">
            Loved by{' '}
            <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">Leaders</span>
          </h2>
        </div>
        <div className="space-y-3">
          {testimonials.map((t, i) => (
            <div key={i} className="p-4 bg-white/3 border border-white/5 rounded-2xl">
              <div className="flex gap-0.5 mb-2">
                {[...Array(5)].map((_, j) => (
                  <Star key={j} className="w-3 h-3 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-xs text-slate-300 leading-relaxed mb-3 italic">&quot;{t.quote}&quot;</p>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center text-white text-xs font-bold">
                  {t.avatar}
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">{t.name}</p>
                  <p className="text-[10px] text-slate-500">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="relative z-10 px-5 py-10">
        <div className="text-center bg-gradient-to-br from-amber-500/10 to-orange-600/10 border border-amber-500/15 rounded-3xl p-7">
          <div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-orange-500/30">
            <Brain className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">
            Ready to Meet Your{' '}
            <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">AI Chief of Staff?</span>
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed mb-6">
            Join thousands of executives who use Ama to reclaim their time and lead smarter — every single day.
          </p>
          <div className="space-y-3">
            <Link
              to="/register"
              id="mobile-cta-register-btn"
              className="flex items-center justify-center gap-2 w-full py-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold rounded-2xl shadow-xl shadow-orange-500/25 active:scale-[0.97] transition-all text-[14px]"
            >
              Get Started — It&apos;s Free
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/login"
              id="mobile-cta-login-btn"
              className="flex items-center justify-center w-full py-3.5 border border-white/10 text-slate-300 font-semibold rounded-2xl transition-all text-[13px]"
            >
              Already have an account? Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t border-white/5 py-6 px-5">
        <div className="flex items-center justify-center gap-3 mb-3">
          <div className="w-7 h-7 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center">
            <Brain className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-bold bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">Ama</span>
          <span className="text-slate-600 text-xs">Chief of Staff Agent</span>
        </div>
        <p className="text-[10px] text-slate-600 text-center">&copy; {new Date().getFullYear()} Ama AI. Your data is private and secure.</p>
      </footer>
    </div>
  );
}

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeFeature, setActiveFeature] = useState(0);

  return (
    <>
      {/* ── Mobile-only customized layout (shown below md breakpoint) ── */}
      <div className="md:hidden">
        <MobileLandingPage />
      </div>

      {/* ── Desktop-only full landing page (hidden on mobile) ── */}
      <div className="hidden md:block min-h-screen bg-[#030014] text-white font-sans">
        {/* Background gradients */}
        <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-amber-600/8 rounded-full blur-3xl" />
          <div className="absolute top-1/3 -right-40 w-[500px] h-[500px] bg-orange-600/8 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/3 w-[400px] h-[400px] bg-amber-500/5 rounded-full blur-3xl" />
        </div>

        {/* ── Navbar ─────────────────────────────────────────────────── */}
        <nav className="relative z-50 border-b border-white/5 bg-[#030014]/80 backdrop-blur-xl sticky top-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              {/* Logo */}
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/30">
                  <Brain className="w-5 h-5 text-white" />
                </div>
                <div>
                  <span className="text-lg font-bold bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">Ama</span>
                  <p className="text-[10px] text-slate-500 leading-none">Chief of Staff Agent</p>
                </div>
              </div>

              {/* Desktop nav */}
              <div className="hidden md:flex items-center gap-8">
                <a href="#features" className="text-sm text-slate-400 hover:text-white transition-colors">Features</a>
                <a href="#integrations" className="text-sm text-slate-400 hover:text-white transition-colors">Integrations</a>
                <a href="#testimonials" className="text-sm text-slate-400 hover:text-white transition-colors">Testimonials</a>
              </div>

              {/* CTA buttons */}
              <div className="hidden md:flex items-center gap-3">
                <Link
                  to="/login"
                  className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 hover:scale-[1.02]"
                >
                  Get Started Free
                </Link>
              </div>

              {/* Mobile menu button (inside desktop wrapper — won't show on md+) */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 text-slate-400 hover:text-white"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Mobile menu */}
          {mobileMenuOpen && (
            <div className="md:hidden border-t border-white/5 bg-[#030014]/95 backdrop-blur-xl px-4 py-4 space-y-3">
              <a href="#features" className="block text-sm text-slate-300 hover:text-white py-2">Features</a>
              <a href="#integrations" className="block text-sm text-slate-300 hover:text-white py-2">Integrations</a>
              <a href="#testimonials" className="block text-sm text-slate-300 hover:text-white py-2">Testimonials</a>
              <div className="pt-3 border-t border-white/5 flex flex-col gap-3">
                <Link to="/login" className="block text-center py-2.5 text-sm font-medium text-slate-300 border border-white/10 rounded-xl hover:bg-white/5 transition-colors">
                  Sign In
                </Link>
                <Link to="/register" className="block text-center py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white text-sm font-semibold rounded-xl">
                  Get Started Free
                </Link>
              </div>
            </div>
          )}
        </nav>

        {/* ── Hero ───────────────────────────────────────────────────── */}
        <section className="relative z-10 pt-20 pb-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-amber-500/20 bg-amber-500/5 text-amber-400 text-xs font-semibold mb-6 backdrop-blur-sm">
              <Sparkles className="w-3.5 h-3.5" />
              Your AI-Powered Chief of Staff
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
              <span className="text-white">Meet </span>
              <span className="bg-gradient-to-r from-amber-400 via-orange-500 to-amber-500 bg-clip-text text-transparent">Ama</span>
              <br />
              <span className="text-white text-3xl sm:text-4xl md:text-5xl">Your Executive AI Partner</span>
            </h1>

            <p className="text-lg sm:text-xl text-slate-400 max-w-3xl mx-auto mb-10 leading-relaxed">
              Ama is an intelligent Chief of Staff that manages your tasks, emails, calendar, and team —
              so you can focus on what truly matters. Available on web and as an installable app.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/register"
                id="hero-register-btn"
                className="group flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold rounded-2xl transition-all shadow-xl shadow-orange-500/25 hover:shadow-orange-500/40 hover:scale-[1.02] active:scale-[0.98] text-base"
              >
                Start for Free
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                to="/login"
                id="hero-login-btn"
                className="flex items-center gap-2 px-8 py-4 border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-white font-semibold rounded-2xl transition-all text-base"
              >
                Sign In to Dashboard
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            {/* App install hint */}
            <p className="mt-6 text-xs text-slate-500">
              📱 Also available as an installable app — install directly from your browser
            </p>
          </div>

          {/* Stats row */}
          <div className="max-w-3xl mx-auto mt-16 grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((s, i) => (
              <div key={i} className="text-center p-4 bg-white/3 border border-white/5 rounded-2xl backdrop-blur-sm hover:border-amber-500/20 transition-all">
                <p className="text-2xl font-bold bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">{s.value}</p>
                <p className="text-xs text-slate-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Features ───────────────────────────────────────────────── */}
        <section id="features" className="relative z-10 py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                Everything You Need to{' '}
                <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">Lead Smarter</span>
              </h2>
              <p className="text-slate-400 max-w-2xl mx-auto">
                8 powerful AI tools working in harmony to help you manage your work, team, and life.
              </p>
            </div>

            {/* Interactive feature grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {features.map((feature, i) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={i}
                    onMouseEnter={() => setActiveFeature(i)}
                    className={`group relative p-6 rounded-2xl border transition-all duration-300 cursor-pointer ${
                      activeFeature === i
                        ? `${feature.bg} ${feature.border} scale-[1.02] shadow-xl`
                        : 'bg-white/3 border-white/5 hover:border-white/10'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-base font-bold text-white mb-2">{feature.title}</h3>
                    <p className="text-sm text-slate-400 leading-relaxed">{feature.description}</p>

                    <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ChevronRight className="w-4 h-4 text-slate-500" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── How It Works ────────────────────────────────────────────── */}
        <section className="relative z-10 py-20 px-4 sm:px-6 lg:px-8 bg-white/2 border-y border-white/5">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Up and Running in{' '}
              <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">60 Seconds</span>
            </h2>
            <p className="text-slate-400 mb-14">No complex setup. Just sign up and start working smarter.</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { step: '01', title: 'Create your account', desc: 'Sign up in seconds with just your email. No credit card required.', icon: Shield },
                { step: '02', title: 'Connect your tools',  desc: 'Link Gmail, Google Calendar, and other services with one click.',   icon: Globe },
                { step: '03', title: 'Let Ama work for you', desc: 'Start chatting with Ama to manage tasks, emails, and your team.',  icon: Zap },
              ].map((s, i) => {
                const Icon = s.icon;
                return (
                  <div key={i} className="relative text-center">
                    <div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-500/20">
                      <Icon className="w-7 h-7 text-white" />
                    </div>
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-slate-800 border border-white/10 rounded-full flex items-center justify-center">
                      <span className="text-[10px] font-bold text-amber-400">{s.step}</span>
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">{s.title}</h3>
                    <p className="text-sm text-slate-400 leading-relaxed">{s.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Integrations ────────────────────────────────────────────── */}
        <section id="integrations" className="relative z-10 py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Connects with Your{' '}
              <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">Favorite Tools</span>
            </h2>
            <p className="text-slate-400 mb-12">Ama brings your entire digital workplace into one intelligent interface.</p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { icon: '📧', name: 'Gmail',           desc: 'Read, manage, and send emails with AI drafts' },
                { icon: '📅', name: 'Google Calendar', desc: 'Sync and schedule events automatically' },
                { icon: '💬', name: 'Slack',           desc: 'Connect via Google OAuth for workspace access' },
                { icon: '📞', name: 'WhatsApp',        desc: 'Receive notifications on your phone' },
              ].map((t, i) => (
                <div key={i} className="p-5 bg-white/3 border border-white/5 rounded-2xl hover:border-amber-500/20 hover:bg-amber-500/5 transition-all group">
                  <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">{t.icon}</div>
                  <h4 className="font-bold text-white text-sm mb-1">{t.name}</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">{t.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Testimonials ────────────────────────────────────────────── */}
        <section id="testimonials" className="relative z-10 py-20 px-4 sm:px-6 lg:px-8 bg-white/2 border-y border-white/5">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-14">
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                Loved by{' '}
                <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">Leaders Everywhere</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {testimonials.map((t, i) => (
                <div key={i} className="p-6 bg-white/3 border border-white/5 rounded-2xl hover:border-amber-500/20 transition-all">
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, j) => (
                      <Star key={j} className="w-4 h-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed mb-5 italic">&quot;{t.quote}&quot;</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center text-white text-sm font-bold">
                      {t.avatar}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{t.name}</p>
                      <p className="text-xs text-slate-500">{t.role}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA Section ─────────────────────────────────────────────── */}
        <section className="relative z-10 py-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-orange-500/30">
              <Brain className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Ready to Meet Your{' '}
              <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">AI Chief of Staff?</span>
            </h2>
            <p className="text-slate-400 mb-10 leading-relaxed">
              Join thousands of executives and managers who use Ama to reclaim their time,
              lead their teams better, and make smarter decisions — every single day.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/register"
                id="cta-register-btn"
                className="group flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold rounded-2xl transition-all shadow-xl shadow-orange-500/25 hover:shadow-orange-500/40 hover:scale-[1.02] text-base"
              >
                Get Started — It&apos;s Free
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                to="/login"
                id="cta-login-btn"
                className="flex items-center gap-2 px-8 py-4 border border-white/10 hover:border-white/20 text-slate-300 hover:text-white font-semibold rounded-2xl transition-all text-base"
              >
                Already have an account? Sign In
              </Link>
            </div>
          </div>
        </section>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <footer className="relative z-10 border-t border-white/5 py-10 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center">
                <Brain className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">Ama</span>
              <span className="text-slate-600 text-sm">Chief of Staff Agent</span>
            </div>

            <div className="flex items-center gap-6">
              <Link to="/login" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">Sign In</Link>
              <Link to="/register" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">Register</Link>
            </div>

            <p className="text-xs text-slate-600 text-center">
              &copy; {new Date().getFullYear()} Ama AI. Your data is private and secure.
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
