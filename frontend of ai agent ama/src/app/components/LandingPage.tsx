import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Download } from 'lucide-react';
import RyveLogo from './RyveLogo';

export default function LandingPage() {
  const [installPrompt, setInstallPrompt] = useState<any>(null);

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

  return (
    <div className="min-h-screen bg-[#0d0d14] text-white font-sans flex flex-col selection:bg-[#FF6B00]/30 selection:text-white">
      {/* Self-contained premium micro-animations style block */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .fade-in-up {
          opacity: 0;
          animation: fadeUp 600ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .delay-1 { animation-delay: 100ms; }
        .delay-2 { animation-delay: 200ms; }
        .delay-3 { animation-delay: 300ms; }
      ` }} />

      {/* ── Navbar ─────────────────────────────────────────────────── */}
      <nav className="z-50 max-w-6xl mx-auto w-full px-6 py-6 flex items-center justify-between sticky top-0 bg-[#0d0d14]/90 backdrop-blur-md border-b border-white/5">
        {/* Logo Mark & Name */}
        <div className="flex items-center gap-3">
          <RyveLogo size={28} variant="dark" />
          <span className="text-lg font-bold text-white tracking-tight font-sans">Ryve</span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-4">
          {installPrompt && (
            <button
              onClick={handleInstall}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-300 border border-white/10 rounded-lg hover:bg-white/5 hover:border-white/20 transition-all flex items-center gap-1.5 shadow-sm"
            >
              <Download className="w-3.5 h-3.5 text-slate-300" />
              Install App
            </button>
          )}
          <Link
            to="/login"
            className="px-4 py-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-all duration-200"
          >
            Sign In
          </Link>
        </div>
      </nav>

      {/* ── Hero Section ────────────────────────────────────────────── */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 pt-20 pb-16 max-w-3xl mx-auto z-10">
        <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight mb-8 leading-[1.08] text-white fade-in-up">
          Your day.<br />
          Under control.
        </h1>

        <p className="text-lg sm:text-xl text-slate-400 font-normal leading-relaxed mb-10 max-w-xl mx-auto fade-in-up delay-1">
          Ryve handles your tasks, calendar, and inbox so you can focus on what actually matters.
        </p>

        <div className="flex flex-col items-center gap-3 fade-in-up delay-2">
          <Link
            to="/login"
            className="px-8 py-4 bg-[#FF6B00] hover:bg-[#ff7b1a] text-white text-base font-bold rounded-xl transition-all duration-200 shadow-md shadow-[#FF6B00]/15 hover:shadow-[#FF6B00]/25 transform active:scale-[0.98]"
          >
            Get Started
          </Link>
          <span className="text-xs text-slate-500 font-medium">
            No credit card required &middot; Free to start
          </span>
        </div>
      </section>

      {/* ── Features Section ────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto w-full px-6 py-20 border-t border-white/5 z-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {/* Card 1: Tasks */}
          <div className="flex flex-col items-start text-left fade-in-up delay-1">
            <span className="text-3xl mb-4 select-none">📋</span>
            <h3 className="text-lg font-bold text-white mb-2 font-sans">Tasks that think ahead</h3>
            <p className="text-sm text-slate-400 leading-relaxed font-normal">
              Prioritised automatically. Always know what to do next.
            </p>
          </div>

          {/* Card 2: Calendar */}
          <div className="flex flex-col items-start text-left fade-in-up delay-2">
            <span className="text-3xl mb-4 select-none">📅</span>
            <h3 className="text-lg font-bold text-white mb-2 font-sans">Calendar without the chaos</h3>
            <p className="text-sm text-slate-400 leading-relaxed font-normal">
              Every event, deadline and meeting in one clean view.
            </p>
          </div>

          {/* Card 3: Inbox */}
          <div className="flex flex-col items-start text-left fade-in-up delay-3">
            <span className="text-3xl mb-4 select-none">✉️</span>
            <h3 className="text-lg font-bold text-white mb-2 font-sans">Inbox on your terms</h3>
            <p className="text-sm text-slate-400 leading-relaxed font-normal">
              Read, reply and action emails without leaving your flow.
            </p>
          </div>
        </div>
      </section>

      {/* ── Social Proof Strip ──────────────────────────────────────── */}
      <section className="w-full px-6 py-12 border-t border-b border-white/5 bg-white/[0.01] z-10">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left">
          <p className="text-sm text-slate-400 font-medium italic max-w-xs">
            &ldquo;Finally, a tool that works like my brain does.&rdquo;
          </p>
          <p className="text-sm text-slate-400 font-medium italic max-w-xs">
            &ldquo;The first thing I open every morning.&rdquo;
          </p>
          <p className="text-sm text-slate-400 font-medium italic max-w-xs">
            &ldquo;Replaced three apps for me.&rdquo;
          </p>
        </div>
      </section>

      {/* ── Final CTA Section ───────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto w-full px-6 py-24 text-center z-10">
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-8 tracking-tight font-sans">
          Ready to take control of your day?
        </h2>
        <Link
          to="/login"
          className="inline-block px-8 py-4 bg-[#FF6B00] hover:bg-[#ff7b1a] text-white text-base font-bold rounded-xl transition-all duration-200 shadow-md shadow-[#FF6B00]/15 hover:shadow-[#FF6B00]/25 transform active:scale-[0.98]"
        >
          Start for free
        </Link>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="w-full max-w-6xl mx-auto px-6 py-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 mt-auto">
        <p className="text-xs text-slate-500 font-medium">
          Ryve &copy; 2026
        </p>
        <div className="flex gap-6">
          <span className="text-xs text-slate-500 hover:text-slate-400 transition-colors cursor-pointer font-medium">
            Privacy
          </span>
          <span className="text-xs text-slate-500 hover:text-slate-400 transition-colors cursor-pointer font-medium">
            Terms
          </span>
        </div>
      </footer>
    </div>
  );
}
