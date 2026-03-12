import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "../services/api";
import { User, AuthResponse } from "../types";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const token = await AsyncStorage.getItem("accessToken");
      if (token) {
        const me = await api.auth.me() as User;
        setUser(me);
      }
    } catch {
      await AsyncStorage.multiRemove(["accessToken", "refreshToken"]);
    } finally {
      setLoading(false);
    }
  }

  async function login(email: string, password: string) {
    const data = (await api.auth.login({ email, password })) as AuthResponse;
    await AsyncStorage.setItem("accessToken", data.accessToken);
    await AsyncStorage.setItem("refreshToken", data.refreshToken);
    setUser(data.user);
  }

  async function register(username: string, email: string, password: string) {
    const data = (await api.auth.register({ username, email, password })) as AuthResponse;
    await AsyncStorage.setItem("accessToken", data.accessToken);
    await AsyncStorage.setItem("refreshToken", data.refreshToken);
    setUser(data.user);
  }

  async function logout() {
    await AsyncStorage.multiRemove(["accessToken", "refreshToken"]);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
