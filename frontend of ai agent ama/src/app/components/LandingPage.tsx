import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Download, ArrowRight, Calendar, Mail, CheckSquare, 
  Users, BarChart3, MessageSquare, Clock, Shield, Sparkles 
} from 'lucide-react';
import RyveLogo from './RyveLogo';

export default function LandingPage() {
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [activeMockup, setActiveMockup] = useState<number>(0);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    setInstallPrompt(null);
  };

  const mockupFeatures = [
    {
      title: "Morning Briefing",
      desc: "Receive a personalized, strategic summary of your day as soon as you wake up. Highlights high-impact items immediately.",
      icon: Clock,
      color: "from-orange-500 to-red-600"
    },
    {
      title: "Command Chat",
      desc: "An elite companion that interacts, refines plans, drafts documents, and queries calendar details securely in natural language.",
      icon: MessageSquare,
      color: "from-blue-500 to-indigo-600"
    },
    {
      title: "Task Orchestrator",
      desc: "An auto-prioritized workspace that aligns lists into strict leverage buckets, ensuring you address bottlenecks first.",
      icon: CheckSquare,
      color: "from-green-500 to-emerald-600"
    },
    {
      title: "Dynamic Calendar",
      desc: "Integrate events, deadlines, and time blocks into a unified timeline that adjusts in real time as dynamics shift.",
      icon: Calendar,
      color: "from-purple-500 to-pink-600"
    },
    {
      title: "Unified Inbox",
      desc: "Filter non-essential clutter and display only key primary communications. Action replies directly using custom drafts.",
      icon: Mail,
      color: "from-amber-500 to-orange-600"
    },
    {
      title: "Delegate Dashboard",
      desc: "Orchestrate team operations, assign deliverables, and monitor project statuses without losing context or loops.",
      icon: Users,
      color: "from-cyan-500 to-blue-600"
    },
    {
      title: "Command Analytics",
      desc: "Gain data-driven executive feedback on calendar distributions, response latency, and general completion rates.",
      icon: BarChart3,
      color: "from-fuchsia-500 to-pink-600"
    }
  ];

  return (
    <div className="min-h-screen bg-[#0d0d14] text-white font-sans flex flex-col selection:bg-[#FF6B00]/30 selection:text-white relative overflow-hidden">
      
      {/* ── Custom HSL style variables & micro-animations ── */}
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@400;500;600;700;800;900&display=swap');
        
        .font-sans { font-family: 'Inter', sans-serif; }
        .font-display { font-family: 'Outfit', sans-serif; }

        @keyframes floatHex {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-15px) rotate(5deg); }
        }
        .animate-hex {
          animation: floatHex 6s ease-in-out infinite;
        }
        
        .glass-panel {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(12px);
        }
        .glass-panel:hover {
          border-color: rgba(255, 107, 0, 0.15);
          background: rgba(255, 255, 255, 0.03);
        }
        
        .mockup-container {
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }
        
        .active-glow {
          box-shadow: 0 0 40px rgba(255, 107, 0, 0.15);
        }
      ` }} />

      {/* ── Floating SVG Backdrop ── */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <svg className="absolute w-[800px] h-[800px] opacity-[0.03] text-orange-500 -top-40 -right-40 animate-hex" viewBox="0 0 100 100">
          <polygon points="50,1 95,25 95,75 50,99 5,75 5,25" fill="none" stroke="currentColor" strokeWidth="0.5" />
        </svg>
        <svg className="absolute w-[600px] h-[600px] opacity-[0.02] text-blue-500 top-[60%] -left-20 animate-hex" style={{ animationDelay: '2s' }} viewBox="0 0 100 100">
          <polygon points="50,1 95,25 95,75 50,99 5,75 5,25" fill="none" stroke="currentColor" strokeWidth="0.5" />
        </svg>
      </div>

      {/* ── Header ── */}
      <header className="z-50 max-w-6xl mx-auto w-full px-6 py-6 flex items-center justify-between sticky top-0 bg-[#0d0d14]/90 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="p-1 bg-[#FF6B00]/10 border border-[#FF6B00]/20 rounded-lg">
            <RyveLogo size={28} variant="dark" />
          </div>
          <span className="text-xl font-bold tracking-tight font-display bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">Ryve</span>
        </div>

        <div className="flex items-center gap-4">
          {installPrompt && (
            <button
              onClick={handleInstall}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-300 border border-white/10 rounded-lg hover:bg-white/5 hover:border-white/20 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-300" />
              Install App
            </button>
          )}
          <Link
            to="/login"
            className="px-5 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-all duration-200"
          >
            Sign In
          </Link>
          <Link
            to="/login"
            className="px-4 py-2 text-xs font-bold text-white bg-[#FF6B00] hover:bg-[#ff7b1a] rounded-lg transition-all shadow-sm hover:shadow-[#FF6B00]/20"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* ── Hero Section ── */}
      <section className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6 pt-24 pb-16 max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/[0.03] border border-white/5 rounded-full text-xs font-medium text-orange-400 mb-8 backdrop-blur-md">
          <Sparkles className="w-3 h-3" />
          <span>Next Generation Executive Leadership Platform</span>
        </div>
        
        <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight mb-8 leading-[1.05] font-display text-white max-w-3xl">
          Your day.<br />
          <span className="bg-gradient-to-r from-[#FF6B00] to-orange-400 bg-clip-text text-transparent">Under complete command.</span>
        </h1>

        <p className="text-base sm:text-lg text-slate-400 font-normal leading-relaxed mb-12 max-w-2xl mx-auto">
          Ryve is the elite personal Chief of Staff command centre. Seamlessly coordinate calendars, automate tasks, align priorities, and command your inbox, all within a beautiful, unified workspace.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-md">
          <Link
            to="/login"
            className="w-full sm:w-auto px-8 py-4 bg-[#FF6B00] hover:bg-[#ff7b1a] text-white text-sm font-bold rounded-xl transition-all duration-200 shadow-md shadow-[#FF6B00]/10 hover:shadow-[#FF6B00]/20 flex items-center justify-center gap-2 group transform active:scale-[0.98]"
          >
            <span>Enter Command Centre</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <a
            href="#showcase"
            className="w-full sm:w-auto px-8 py-4 bg-white/[0.02] hover:bg-white/[0.05] text-slate-300 hover:text-white text-sm font-semibold rounded-xl border border-white/5 hover:border-white/10 transition-all text-center"
          >
            Explore Showcase
          </a>
        </div>
        
        <p className="text-xs text-slate-500 mt-5 font-medium">
          Zero friction &bull; Fully offline capable &bull; Standard Web-Push enabled
        </p>
      </section>

      {/* ── Feature Showcase Section ── */}
      <section id="showcase" className="relative z-10 max-w-6xl mx-auto w-full px-6 py-24 border-t border-white/5">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white font-display mb-4">Command Center Feature Suite</h2>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
            Beautifully integrated modules working in absolute harmony to handle schedule orchestration, prioritisation pipelines, and communication channels.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
          
          {/* Interactive Feature Selectors (Left side) */}
          <div className="lg:col-span-5 flex flex-col gap-3">
            {mockupFeatures.map((feat, idx) => {
              const Icon = feat.icon;
              const isActive = activeMockup === idx;
              return (
                <button
                  key={idx}
                  onClick={() => setActiveMockup(idx)}
                  className={`w-full text-left p-4 rounded-xl transition-all cursor-pointer flex gap-4 ${
                    isActive 
                      ? 'bg-white/[0.03] border border-orange-500/20 active-glow' 
                      : 'bg-transparent border border-transparent hover:bg-white/[0.01]'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-gradient-to-br ${feat.color} shadow-md`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className={`text-sm font-bold font-display transition-colors ${isActive ? 'text-orange-400' : 'text-slate-200'}`}>
                      {feat.title}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">{feat.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Interactive CSS Mockups Display (Right side) */}
          <div className="lg:col-span-7 flex items-center justify-center">
            <div className="w-full mockup-container bg-[#0b0819] rounded-2xl p-4 sm:p-6 min-h-[460px] flex flex-col relative overflow-hidden">
              
              {/* Mockup Header Grid */}
              <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4 flex-shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                </div>
                <div className="px-6 py-1 bg-white/[0.02] border border-white/5 rounded-full text-[10px] text-slate-500 font-mono tracking-tight select-none">
                  ryve.command.centre
                </div>
                <div className="w-8" />
              </div>

              {/* Showcase Render Engine */}
              <div className="flex-1 flex flex-col justify-center">
                
                {/* mockup 0: Morning Briefing */}
                {activeMockup === 0 && (
                  <div className="space-y-4 max-w-md mx-auto w-full">
                    <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="text-[10px] text-orange-400 font-bold uppercase tracking-wider">Morning Briefing</p>
                          <h4 className="text-base font-bold text-white mt-0.5">Good morning, Commander</h4>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono bg-white/5 px-2 py-0.5 rounded">07:30 AM</span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed italic">
                        "Your agenda is compact. You have 3 primary objectives, starting with the Executive Sync in 30 minutes. High leverage action is required on task alignment."
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-white/[0.01] border border-white/5 rounded-xl">
                        <span className="text-xs text-slate-500 block mb-1">Today's Focus</span>
                        <p className="text-xs font-bold text-[#FF6B00]">Resolve Team Bottlenecks</p>
                      </div>
                      <div className="p-3 bg-white/[0.01] border border-white/5 rounded-xl">
                        <span className="text-xs text-slate-500 block mb-1">Schedule Load</span>
                        <p className="text-xs font-bold text-green-400">Optimal (4.2 hrs)</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* mockup 1: Command Chat */}
                {activeMockup === 1 && (
                  <div className="space-y-4 w-full">
                    {/* User Query */}
                    <div className="flex justify-end">
                      <div className="max-w-[75%] p-3 bg-[#FF6B00]/10 border border-[#FF6B00]/20 rounded-2xl rounded-tr-none text-xs text-slate-200">
                        Suggest priorities for my day based on overdue items.
                      </div>
                    </div>
                    
                    {/* Assistant Response */}
                    <div className="flex gap-3 items-start">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                        <RyveLogo size={18} variant="dark" />
                      </div>
                      <div className="flex-1 max-w-[80%] p-3 bg-white/[0.02] border border-white/5 rounded-2xl rounded-tl-none text-xs text-slate-300 space-y-2">
                        <p className="font-semibold text-[#FF6B00]">Recommended Priorities:</p>
                        <ol className="list-decimal list-inside space-y-1 text-slate-400">
                          <li>Review and dispatch the delegated QA pipeline</li>
                          <li>Approve email drafts for client onboarding</li>
                          <li>Allocate blocks for overdue marketing syncs</li>
                        </ol>
                      </div>
                    </div>
                  </div>
                )}

                {/* mockup 2: Task Orchestrator */}
                {activeMockup === 2 && (
                  <div className="space-y-3 max-w-sm mx-auto w-full">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Leverage Stack</span>
                      <span className="text-[10px] text-orange-400 font-mono">3 / 8 Resolved</span>
                    </div>

                    {[
                      { label: "Resolve executive dashboard blocking items", priority: "High Leverage", active: true },
                      { label: "Draft strategic direction memo", priority: "Medium Leverage", active: false },
                      { label: "Approve team task matrix delegations", priority: "Low Leverage", active: false }
                    ].map((task, idx) => (
                      <div key={idx} className="p-3 bg-white/[0.02] border border-white/5 rounded-xl flex items-center gap-3">
                        <input type="checkbox" checked={task.active} className="w-4 h-4 accent-[#FF6B00] rounded cursor-pointer" readOnly />
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs truncate ${task.active ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                            {task.label}
                          </p>
                        </div>
                        <span className={`text-[9px] px-2 py-0.5 rounded font-mono ${
                          idx === 0 ? 'bg-red-500/10 text-red-400' : idx === 1 ? 'bg-yellow-500/10 text-yellow-400' : 'bg-blue-500/10 text-blue-400'
                        }`}>
                          {task.priority}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* mockup 3: Dynamic Calendar */}
                {activeMockup === 3 && (
                  <div className="space-y-2 max-w-md mx-auto w-full">
                    <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl flex items-center gap-4">
                      <div className="text-center bg-[#FF6B00]/10 border border-[#FF6B00]/20 rounded-lg p-2 flex-shrink-0 w-12">
                        <span className="text-xs text-orange-400 block font-bold">10:00</span>
                        <span className="text-[9px] text-slate-500 uppercase">AM</span>
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">Executive Sync &amp; Backlog Audit</h4>
                        <p className="text-[10px] text-slate-500">Board Room &bull; 45 mins</p>
                      </div>
                      <span className="ml-auto text-[9px] px-2 py-0.5 rounded bg-green-500/10 text-green-400 font-mono">Active</span>
                    </div>

                    <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl flex items-center gap-4 opacity-60">
                      <div className="text-center bg-white/5 rounded-lg p-2 flex-shrink-0 w-12">
                        <span className="text-xs text-slate-400 block font-bold">12:30</span>
                        <span className="text-[9px] text-slate-500 uppercase">PM</span>
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">Deep Work Time Block</h4>
                        <p className="text-[10px] text-slate-500">Focus Mode &bull; 90 mins</p>
                      </div>
                      <span className="ml-auto text-[9px] px-2 py-0.5 rounded bg-slate-500/10 text-slate-400 font-mono">Queued</span>
                    </div>
                  </div>
                )}

                {/* mockup 4: Unified Inbox */}
                {activeMockup === 4 && (
                  <div className="space-y-3 max-w-sm mx-auto w-full">
                    <div className="p-3 bg-[#FF6B00]/5 border border-[#FF6B00]/15 rounded-xl">
                      <div className="flex justify-between items-center mb-1">
                        <h5 className="text-xs font-bold text-slate-200">Alex Mercer</h5>
                        <span className="text-[9px] text-slate-500">2 mins ago</span>
                      </div>
                      <p className="text-xs font-semibold text-slate-300 truncate">Immediate Review Required: Strategic Memo</p>
                      <p className="text-[10px] text-slate-400 mt-1 truncate">Hey team, please audit the attached strategic memo before the Executive Sync...</p>
                      
                      {/* Simulated AI Reply Compose */}
                      <div className="mt-3 p-2 bg-[#0d0d14] border border-white/5 rounded-lg text-[10px] text-[#FF6B00] italic flex items-center gap-2 select-none">
                        <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                        Drafting reply: "Hi Alex, reviewed. Details look solid. Added remarks..."
                      </div>
                    </div>
                  </div>
                )}

                {/* mockup 5: Delegate Dashboard */}
                {activeMockup === 5 && (
                  <div className="grid grid-cols-2 gap-3 w-full">
                    {[
                      { name: "Sarah Connor", role: "Product Delivery", task: "QA Pipeline Audit", pct: 75, color: "bg-blue-500" },
                      { name: "David Miller", role: "Market Intelligence", task: "Competitor Benchmark", pct: 40, color: "bg-[#FF6B00]" }
                    ].map((del, idx) => (
                      <div key={idx} className="p-3 bg-white/[0.02] border border-white/5 rounded-xl space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="text-xs font-bold text-white">{del.name}</h4>
                            <p className="text-[9px] text-slate-500">{del.role}</p>
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-300 font-semibold truncate">{del.task}</p>
                          <div className="w-full bg-white/5 h-1 rounded-full mt-2 overflow-hidden">
                            <div className={`${del.color} h-full`} style={{ width: `${del.pct}%` }} />
                          </div>
                          <div className="flex justify-between items-center mt-1">
                            <span className="text-[8px] text-slate-500">Progress</span>
                            <span className="text-[8px] text-slate-300 font-mono">{del.pct}%</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* mockup 6: Command Analytics */}
                {activeMockup === 6 && (
                  <div className="space-y-4 max-w-sm mx-auto w-full">
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: "Focus Rate", val: "88%", delta: "+12%" },
                        { label: "Completion", val: "94%", delta: "+5%" },
                        { label: "Delegations", val: "12/15", delta: "On Track" }
                      ].map((stat, idx) => (
                        <div key={idx} className="p-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-center">
                          <span className="text-[9px] text-slate-500 block mb-1">{stat.label}</span>
                          <p className="text-base font-bold text-white">{stat.val}</p>
                          <span className="text-[8px] text-green-400 font-mono block mt-0.5">{stat.delta}</span>
                        </div>
                      ))}
                    </div>

                    <div className="p-3 bg-white/[0.01] border border-white/5 rounded-xl">
                      <p className="text-[9px] text-slate-500 uppercase tracking-wider font-bold mb-2">Completion Efficiency Graph</p>
                      <div className="flex items-end justify-between gap-1.5 h-16 pt-2">
                        {[40, 60, 50, 75, 90, 80, 95].map((val, idx) => (
                          <div key={idx} className="flex-1 bg-white/5 rounded-t overflow-hidden h-full flex items-end">
                            <div className="w-full bg-[#FF6B00] rounded-t" style={{ height: `${val}%` }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ── Security & Architecture Badges ── */}
      <section className="relative z-10 w-full px-6 py-16 border-t border-b border-white/5 bg-white/[0.005]">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 items-center text-center">
          <div className="flex flex-col items-center p-4">
            <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mb-4 text-[#FF6B00]">
              <Shield className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-white mb-2">Absolute Confidentiality</h4>
            <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
              We employ strict client-side encryption and standard token refresh patterns. Your data never trains models.
            </p>
          </div>
          
          <div className="flex flex-col items-center p-4">
            <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mb-4 text-[#FF6B00]">
              <Sparkles className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-white mb-2">Adaptive Command Layout</h4>
            <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
              Engineered using the premium Outfit typography and deep HSL palettes for maximum screen scannability.
            </p>
          </div>

          <div className="flex flex-col items-center p-4">
            <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mb-4 text-[#FF6B00]">
              <Download className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-white mb-2">Premium PWA Integration</h4>
            <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
              Install Ryve directly onto your desktop or mobile screen. Zero dependencies, offline persistence on load.
            </p>
          </div>
        </div>
      </section>

      {/* ── Final Call to Action ── */}
      <section className="relative z-10 max-w-4xl mx-auto w-full px-6 py-28 text-center">
        <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-6 tracking-tight font-display">
          Ready to take complete control of your day?
        </h2>
        <p className="text-slate-400 text-sm sm:text-base leading-relaxed mb-10 max-w-xl mx-auto">
          Establish your premium command centre today. Elevate output, streamline calendar bottlenecks, and orchestrate with excellence.
        </p>
        <Link
          to="/login"
          className="inline-block px-10 py-5 bg-[#FF6B00] hover:bg-[#ff7b1a] text-white text-base font-bold rounded-xl transition-all duration-200 shadow-md shadow-[#FF6B00]/10 hover:shadow-[#FF6B00]/25 transform active:scale-[0.98] cursor-pointer"
        >
          Access the Command Centre
        </Link>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 w-full max-w-6xl mx-auto px-6 py-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 mt-auto">
        <p className="text-xs text-slate-500 font-medium">
          Ryve Systems &copy; 2026 &bull; Elevating Executive Command
        </p>
        <div className="flex gap-6">
          <span className="text-xs text-slate-500 hover:text-slate-400 transition-colors cursor-pointer font-medium">
            Privacy Charter
          </span>
          <span className="text-xs text-slate-500 hover:text-slate-400 transition-colors cursor-pointer font-medium">
            Terms of Deployment
          </span>
        </div>
      </footer>
    </div>
  );
}
