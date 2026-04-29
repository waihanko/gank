'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

export interface User {
  id: string;
  username: string;
  mlbb_ign: string;
  telegram_username: string;
  telegram_display_name?: string | null;
  telegram_bio?: string | null;
  avatar_url?: string | null;
  mlbb_server_id?: string;
  mlbb_zone_id?: string;
  wins?: number;
  losses?: number;
  wallet?: {
    balance: number;
    frozen_amount: number;
    total_won: number;
    total_lost: number;
  };
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoggedIn: boolean;
  loading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
  syncProfile: () => Promise<void>;
  requireAuth: () => boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isLoggedIn: false,
  loading: true,
  login: () => {},
  logout: () => {},
  refreshUser: async () => {},
  syncProfile: async () => {},
  requireAuth: () => false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem('gr_token');
    const savedUser = localStorage.getItem('gr_user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      try {
        setUser(JSON.parse(savedUser));
      } catch {}
    }
    setLoading(false);
  }, []);

  function login(newToken: string, newUser: User) {
    localStorage.setItem('gr_token', newToken);
    localStorage.setItem('gr_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }

  function logout() {
    localStorage.removeItem('gr_token');
    localStorage.removeItem('gr_user');
    setToken(null);
    setUser(null);
    window.location.href = '/login';
  }

  async function refreshUser() {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setUser(data.data);
        localStorage.setItem('gr_user', JSON.stringify(data.data));
      } else if (res.status === 401) {
        logout();
      }
    } catch {}
  }

  async function syncProfile() {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/auth/sync-profile`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setUser((prev) => prev ? { ...prev, ...data.data } : data.data);
        localStorage.setItem('gr_user', JSON.stringify({ ...user, ...data.data }));
      } else if (res.status === 401) {
        logout();
      }
    } catch (e) {
      console.error('Failed to sync profile', e);
    }
  }

  function requireAuth(): boolean {
    if (!token) {
      window.location.href = '/login';
      return false;
    }
    return true;
  }

  return (
    <AuthContext.Provider value={{ user, token, isLoggedIn: !!token, loading, login, logout, refreshUser, syncProfile, requireAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
