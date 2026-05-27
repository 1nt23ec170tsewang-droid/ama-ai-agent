import React from 'react';
import RyveLogo from './RyveLogo';

export default function RyveSplashScreen() {
  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: '#0d0d14',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '16px'
    }}>
      <RyveLogo size={72} variant="dark" />
      <p style={{
        color: '#FF6B00',
        fontSize: '13px',
        letterSpacing: '0.15em',
        fontWeight: 500
      }}>
        AI CHIEF OF STAFF
      </p>
    </div>
  );
}
