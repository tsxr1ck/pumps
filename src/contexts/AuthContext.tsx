import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { User, AuthTokens } from '@/types';
import { setTokens } from '@/lib/api';

interface AuthContextValue {
  user: User | null;
  login: (user: User, tokens: AuthTokens) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function getInitialUser(): User | null {
  const saved = localStorage.getItem('pumps_user');
  if (saved) {
    try {
      return JSON.parse(saved) as User;
    } catch {
      return null;
    }
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(getInitialUser);

  const login = useCallback((newUser: User, tokens: AuthTokens) => {
    setTokens(tokens);
    localStorage.setItem('pumps_user', JSON.stringify(newUser));
    setUser(newUser);
  }, []);

  const logout = useCallback(() => {
    setTokens(null);
    localStorage.removeItem('pumps_user');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, login, logout, isAuthenticated: !!user }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
