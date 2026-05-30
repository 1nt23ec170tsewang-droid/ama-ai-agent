const DB_NAME = 'ama-auth';
const STORE_NAME = 'session';

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveAuthSession(token: string, refreshToken: string, user: any, expiry: number) {
  // Sync to localStorage
  localStorage.setItem('ama_token', token);
  localStorage.setItem('ama_refresh_token', refreshToken);
  localStorage.setItem('ama_user', JSON.stringify(user));
  localStorage.setItem('ama_token_expiry', String(expiry));

  // Async backup to IndexedDB (Fix 5)
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put({ token, refreshToken, user, expiry }, 'auth');
  } catch (err) {
    console.warn('IndexedDB write failed:', err);
  }
}

export async function readAuthSession(): Promise<{ token: string; refreshToken: string; user: any; expiry: number } | null> {
  // 1. Try localStorage first (fast, synchronous)
  const token = localStorage.getItem('ama_token');
  if (token) {
    return {
      token,
      refreshToken: localStorage.getItem('ama_refresh_token') || '',
      user: JSON.parse(localStorage.getItem('ama_user') || 'null'),
      expiry: Number(localStorage.getItem('ama_token_expiry') || '0')
    };
  }

  // 2. Try IndexedDB fallback (iOS storage pressure recovery)
  try {
    const db = await getDB();
    const session = await new Promise<any>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get('auth');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    if (session) {
      // Re-hydrate localStorage from IndexedDB backup
      localStorage.setItem('ama_token', session.token);
      localStorage.setItem('ama_refresh_token', session.refreshToken);
      localStorage.setItem('ama_user', JSON.stringify(session.user));
      localStorage.setItem('ama_token_expiry', String(session.expiry));
      return session;
    }
  } catch (err) {
    console.warn('IndexedDB read failed:', err);
  }

  return null;
}

export async function clearAuthSession() {
  localStorage.removeItem('ama_token');
  localStorage.removeItem('ama_refresh_token');
  localStorage.removeItem('ama_user');
  localStorage.removeItem('ama_token_expiry');
  localStorage.removeItem('authToken'); // Legacy backup compatibility

  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete('auth');
  } catch (err) {
    console.warn('IndexedDB delete failed:', err);
  }
}
