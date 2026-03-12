import AsyncStorage from "@react-native-async-storage/async-storage";

const API_URL = "http://localhost:3000/api";

async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem("accessToken");
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 401 && token) {
    const refreshed = await refreshTokens();
    if (refreshed) {
      headers.Authorization = `Bearer ${refreshed}`;
      const retry = await fetch(`${API_URL}${path}`, { ...options, headers });
      if (!retry.ok) throw new Error(await retry.text());
      return retry.json();
    }
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || "Request failed");
  }

  return res.json();
}

async function refreshTokens(): Promise<string | null> {
  try {
    const refreshToken = await AsyncStorage.getItem("refreshToken");
    if (!refreshToken) return null;

    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    await AsyncStorage.setItem("accessToken", data.accessToken);
    await AsyncStorage.setItem("refreshToken", data.refreshToken);
    return data.accessToken;
  } catch {
    return null;
  }
}

export const api = {
  auth: {
    register: (data: { username: string; email: string; password: string; displayName?: string }) =>
      request("/auth/register", { method: "POST", body: JSON.stringify(data) }),
    login: (data: { email: string; password: string }) =>
      request("/auth/login", { method: "POST", body: JSON.stringify(data) }),
    me: () => request("/auth/me"),
  },
  users: {
    list: (search?: string) =>
      request(`/users${search ? `?search=${encodeURIComponent(search)}` : ""}`),
    updateProfile: (data: { displayName?: string; avatarUrl?: string }) =>
      request("/users/profile", { method: "PATCH", body: JSON.stringify(data) }),
  },
  conversations: {
    list: () => request("/conversations"),
    create: (data: { participantIds: string[]; name?: string; isGroup?: boolean }) =>
      request("/conversations", { method: "POST", body: JSON.stringify(data) }),
    get: (id: string) => request(`/conversations/${id}`),
  },
  messages: {
    list: (conversationId: string, cursor?: string) =>
      request(`/messages/${conversationId}${cursor ? `?cursor=${cursor}` : ""}`),
  },
  calls: {
    history: (limit?: number) =>
      request(`/calls/history${limit ? `?limit=${limit}` : ""}`),
  },
};
