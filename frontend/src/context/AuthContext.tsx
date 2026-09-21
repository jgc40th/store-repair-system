import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { AppUser } from "../types";
import { clearSession } from "../lib/api";

interface AuthContextValue {
  user: AppUser | null;
  isLoading: boolean;
  login: (sessionToken: string, user: AppUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem("app_user");
    if (raw) {
      try {
        setUser(JSON.parse(raw));
      } catch {
        clearSession();
      }
    }
    setIsLoading(false);
  }, []);

  function login(sessionToken: string, user: AppUser) {
    localStorage.setItem("session_token", sessionToken);
    localStorage.setItem("app_user", JSON.stringify(user));
    setUser(user);
  }

  function logout() {
    clearSession();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth 必須在 AuthProvider 內使用");
  return ctx;
}
