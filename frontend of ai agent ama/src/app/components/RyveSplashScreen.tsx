import { useEffect, useState } from 'react';
import RyveLogo from './RyveLogo';

export default function RyveSplashScreen() {
  const [progress, setProgress] = useState(0);
  const [fade, setFade] = useState(false);

  useEffect(() => {
    // Animate progress bar
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + Math.random() * 15 + 5;
      });
    }, 120);

    // Fade out trigger
    const fadeTimer = setTimeout(() => setFade(true), 1400);

    return () => {
      clearInterval(interval);
      clearTimeout(fadeTimer);
    };
  }, []);

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: 'linear-gradient(135deg, #09051d 0%, #0d0d14 60%, #12071f 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '24px',
        transition: 'opacity 0.4s ease',
        opacity: fade ? 0 : 1,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Ambient background glow */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -60%)',
        width: '400px',
        height: '400px',
        background: 'radial-gradient(ellipse, rgba(255, 107, 0, 0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Logo block */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(255,107,0,0.15), rgba(255,107,0,0.05))',
          borderRadius: '20px',
          padding: '18px',
          border: '1px solid rgba(255,107,0,0.15)',
          boxShadow: '0 0 60px rgba(255,107,0,0.08)',
        }}>
          <RyveLogo size={64} variant="dark" />
        </div>

        <div style={{ textAlign: 'center' }}>
          <p style={{
            color: '#fff',
            fontSize: '28px',
            fontWeight: 800,
            letterSpacing: '-0.02em',
            fontFamily: "'Inter', system-ui, sans-serif",
            margin: 0,
            lineHeight: 1.2,
          }}>Ryve</p>
          <p style={{
            color: 'rgba(255,255,255,0.4)',
            fontSize: '11px',
            letterSpacing: '0.2em',
            fontWeight: 500,
            fontFamily: "'Inter', system-ui, sans-serif",
            margin: '4px 0 0 0',
            textTransform: 'uppercase',
          }}>AI Chief of Staff</p>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{
        width: '160px',
        height: '2px',
        background: 'rgba(255,255,255,0.06)',
        borderRadius: '999px',
        overflow: 'hidden',
        marginTop: '8px',
      }}>
        <div style={{
          height: '100%',
          width: `${Math.min(progress, 100)}%`,
          background: 'linear-gradient(90deg, #FF6B00, #ff9a4d)',
          borderRadius: '999px',
          transition: 'width 0.12s ease',
        }} />
      </div>
    </div>
  );
}
