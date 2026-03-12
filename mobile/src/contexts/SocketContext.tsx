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

const SERVER_URL = "http://localhost:3000";

export function SocketProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    AsyncStorage.getItem("accessToken").then((token) => {
      if (!token) return;

      const socket = io(SERVER_URL, {
        auth: { token },
        transports: ["websocket"],
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
    });

    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [user]);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, onlineUsers }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
