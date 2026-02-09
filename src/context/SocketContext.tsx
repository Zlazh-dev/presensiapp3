import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

interface SocketContextType {
    socket: Socket | null;
    isConnected: boolean;
    joinSession: (sessionId: number) => void;
    leaveSession: (sessionId: number) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { token, user } = useAuth();
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [sessionsSocket, setSessionsSocket] = useState<Socket | null>(null);

    // Initialize Global Socket
    useEffect(() => {
        if (!token) return;

        const newSocket = io('http://localhost:5000', {
            auth: { token },
            transports: ['websocket', 'polling'],
            withCredentials: true
        });

        newSocket.on('connect', () => {
            console.log('Socket Connected:', newSocket.id);
            setIsConnected(true);
        });

        newSocket.on('disconnect', () => {
            console.log('Socket Disconnected');
            setIsConnected(false);
        });

        setSocket(newSocket);

        // Initialize Sessions Namespace Socket
        const sessSocket = io('http://localhost:5000/sessions', {
            auth: { token },
            transports: ['websocket', 'polling'],
            withCredentials: true
        });
        setSessionsSocket(sessSocket);

        return () => {
            newSocket.disconnect();
            sessSocket.disconnect();
        };
    }, [token]);

    const joinSession = (sessionId: number) => {
        if (sessionsSocket) {
            sessionsSocket.emit('join:session', { sessionId });
        }
    };

    const leaveSession = (sessionId: number) => {
        if (sessionsSocket) {
            sessionsSocket.emit('leave:session', { sessionId });
        }
    };

    return (
        <SocketContext.Provider value={{ socket: sessionsSocket, isConnected, joinSession, leaveSession }}>
            {children}
        </SocketContext.Provider>
    );
};

export const useSocket = () => {
    const context = useContext(SocketContext);
    if (context === undefined) {
        throw new Error('useSocket must be used within a SocketProvider');
    }
    return context;
};
