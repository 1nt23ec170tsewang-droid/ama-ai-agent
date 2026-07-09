import { useEffect } from 'react';
import { useNavigate } from 'react-router';

export default function SmartRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');
    if (hasSeenOnboarding) {
      navigate('/login', { replace: true });
    } else {
      navigate('/splash', { replace: true });
    }
  }, [navigate]);

  // Show nothing while deciding
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0d0d14' }} />
  );
}