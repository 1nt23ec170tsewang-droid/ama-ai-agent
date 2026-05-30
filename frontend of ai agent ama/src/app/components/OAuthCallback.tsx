import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import RyveSplashScreen from './RyveSplashScreen';
import { API_BASE } from '../utils/config';
import { saveAuthSession } from '../utils/pwaAuth';

export default function OAuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  
  // Find which provider it is based on the URL path
  const provider = location.pathname.split('/').pop() || ''; // 'google' | 'facebook' | 'linkedin'
  
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      console.error(`${provider} OAuth error:`, error);
      showToast('Permission denied. Try again.', 'error');
      navigate('/login', { replace: true });
      return;
    }

    if (!code) {
      showToast('Login failed. Please retry.', 'error');
      navigate('/login', { replace: true });
      return;
    }

    // Call backend to exchange code for token
    const exchangeCode = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/${provider}/callback`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ code })
        });

        if (!res.ok) {
          throw new Error('Code exchange failed');
        }

        const data = await res.json();
        if (data.accessToken && data.user) {
          // Double-store for persistent session restoration (Fix 5)
          const expiry = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
          // Generate a mock refresh token value since silent refresh runs on HTTP-Only cookie,
          // but we still persist a backup in LocalStorage/IndexedDB for cold start references
          const backupRefreshToken = data.refreshToken || `mock_rtr_${Date.now()}`;
          
          await saveAuthSession(data.accessToken, backupRefreshToken, data.user, expiry);
          showToast('Login successful!', 'success');
          
          // Force active redirection
          window.location.href = '/dashboard';
        } else {
          throw new Error('No token returned');
        }
      } catch (err) {
        console.error(`${provider} callback error:`, err);
        showToast('Login failed. Please retry.', 'error');
        navigate('/login', { replace: true });
      }
    };

    exchangeCode();
  }, [location, provider, navigate, showToast]);

  return <RyveSplashScreen />;
}
