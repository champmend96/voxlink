import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { io, Socket } from "socket.io-client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "./AuthContext";

interface SocketContextType {
  socket: Socket | null;
  onlineUsers: Set<string>;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  onlineUsers: new Set(),
});

const SERVER_URL = "https://voxlink-backend.onrender.com";

export function SocketProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [socketState, setSocketState] = useState<Socket | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocketState(null);
      }
      return;
    }

    AsyncStorage.getItem("accessToken").then((token) => {
      if (!token) return;

      const socket = io(SERVER_URL, {
        auth: { token },
        transports: ["websocket"],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

      socket.on("connect", () => {
        setSocketState(socket);
      });

      socket.on("disconnect", () => {
        setSocketState(null);
      });

      socket.on("reconnect", () => {
        setSocketState(socket);
      });

      socket.on("online-status", (data: { userId: string; online: boolean }) => {
        setOnlineUsers((prev) => {
          const next = new Set(prev);
          if (data.online) next.add(data.userId);
          else next.delete(data.userId);
          return next;
        });
      });

      socketRef.current = socket;
      setSocketState(socket);
    });

    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocketState(null);
    };
  }, [user]);

  return (
    <SocketContext.Provider value={{ socket: socketState, onlineUsers }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
