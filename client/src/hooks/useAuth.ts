import { useState, useEffect, useCallback } from 'react';
import { setToken } from '../api/http';

interface AuthState {
  authenticated: boolean;
  username: string | null;
  loading: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    authenticated: false,
    username: null,
    loading: true,
  });

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      setState({ authenticated: false, username: null, loading: false });
      return;
    }
    // Verify token — use raw fetch to avoid the 401 interceptor
    fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Invalid token');
        return res.json();
      })
      .then((data) => {
        setState({ authenticated: true, username: data.username, loading: false });
      })
      .catch(() => {
        setToken(null);
        setState({ authenticated: false, username: null, loading: false });
      });
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || 'Login failed');
    }
    const data = await res.json();
    setToken(data.token);
    setState({ authenticated: true, username: data.username, loading: false });
  }, []);

  const logout = useCallback(async () => {
    const token = localStorage.getItem('auth_token');
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
      });
    } catch { /* ignore */ }
    setToken(null);
    setState({ authenticated: false, username: null, loading: false });
  }, []);

  return { ...state, login, logout };
}
