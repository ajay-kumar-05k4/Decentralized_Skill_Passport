import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('dsp_user') || 'null');
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('dsp_token'));
  const [loading, setLoading] = useState(Boolean(localStorage.getItem('dsp_token')));

  const persist = (nextUser, nextToken) => {
    setUser(nextUser);
    setToken(nextToken);
    if (nextUser && nextToken) {
      localStorage.setItem('dsp_user', JSON.stringify(nextUser));
      localStorage.setItem('dsp_token', nextToken);
    } else {
      localStorage.removeItem('dsp_user');
      localStorage.removeItem('dsp_token');
    }
  };

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get('/auth/me')
      .then((res) => persist(res.data.data, token))
      .catch(() => persist(null, null))
      .finally(() => setLoading(false));
  }, [token]);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    persist(res.data.data, res.data.token);
    return res.data.data;
  };

  const register = async (payload) => {
    const res = await api.post('/auth/register', payload);
    persist(res.data.data, res.data.token);
    return res.data.data;
  };

  const logout = () => persist(null, null);

  const refreshUser = async () => {
    const res = await api.get('/auth/me');
    persist(res.data.data, token);
    return res.data.data;
  };

  const value = useMemo(
    () => ({ user, token, loading, login, register, logout, refreshUser, persist }),
    [user, token, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
