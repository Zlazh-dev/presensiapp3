import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';

let io: SocketIOServer;

export const initSocket = (httpServer: HttpServer) => {
    io = new SocketIOServer(httpServer, {
        cors: {
            origin: ['http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5173'],
            methods: ['GET', 'POST'],
            credentials: true
        },
        transports: ['websocket', 'polling']
    });

    // Default namespace
    io.on('connection', (socket) => {
        console.log('Client connected (Global):', socket.id);
        socket.on('join:room', (room) => {
            socket.join(room);
            console.log(`Client ${socket.id} joined room: ${room}`);
        });
        socket.on('disconnect', () => {
            // console.log('Client disconnected:', socket.id);
        });
    });

    // /sessions namespace
    const sessionsNamespace = io.of('/sessions');
    sessionsNamespace.on('connection', (socket) => {
        console.log('Client connected (Sessions):', socket.id);

        socket.on('join:session', ({ sessionId }) => {
            const room = `session-${sessionId}`;
            socket.join(room);
            console.log(`Client ${socket.id} joined session room: ${room}`);
        });

        socket.on('leave:session', ({ sessionId }) => {
            const room = `session-${sessionId}`;
            socket.leave(room);
        });
    });

    return io;
};

export const getIO = () => {
    if (!io) {
        // Return a mock IO if not initialized (for scripts/tests)
        // console.warn('Socket.io not initialized, using mock');
        return {
            emit: () => { },
            to: () => ({ emit: () => { } }),
            of: () => ({
                emit: () => { },
                to: () => ({ emit: () => { } }),
                on: () => { }
            })
        } as unknown as SocketIOServer;
    }
    return io;
};
