import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem('noticeboard_user')) || null; } catch { return null; } });
  const [ready, setReady] = useState(() => !localStorage.getItem('noticeboard_token'));
  useEffect(() => {
    if (!localStorage.getItem('noticeboard_token')) return;
    let active = true;
    api.get('/users/me').then(({ data }) => {
      if (!active) return;
      const profile = data.data;
      localStorage.setItem('noticeboard_user', JSON.stringify(profile));
      setUser(profile);
    }).catch(() => {
      if (!active) return;
      localStorage.removeItem('noticeboard_token');
      localStorage.removeItem('noticeboard_user');
      setUser(null);
    }).finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);
  async function login(credentials) {
    const { data } = await api.post('/auth/login', credentials);
    localStorage.setItem('noticeboard_token', data.data.token);
    localStorage.setItem('noticeboard_user', JSON.stringify(data.data.user));
    setUser(data.data.user);
    return data.data.user;
  }
  async function adminLogin(credentials) {
    const { data } = await api.post('/auth/admin-login', credentials);
    localStorage.setItem('noticeboard_token', data.data.token);
    localStorage.setItem('noticeboard_user', JSON.stringify(data.data.user));
    setUser(data.data.user);
    return data.data.user;
  }
  async function register(details) {
    const safeDetails = Object.fromEntries(Object.entries(details).filter(([key]) => key !== 'role'));
    const { data } = await api.post('/auth/register', safeDetails);
    localStorage.setItem('noticeboard_token', data.data.token);
    localStorage.setItem('noticeboard_user', JSON.stringify(data.data.user));
    setUser(data.data.user);
    return data.data.user;
  }
  function logout() {
    localStorage.removeItem('noticeboard_token');
    localStorage.removeItem('noticeboard_user');
    setUser(null);
  }
  function updateUser(profile) { localStorage.setItem('noticeboard_user', JSON.stringify(profile)); setUser(profile); }
  const value = useMemo(() => ({ user, ready, login, adminLogin, register, logout, updateUser }), [user, ready]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
