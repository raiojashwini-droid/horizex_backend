import { Server as SocketIOServer } from 'socket.io';
import type { Server as HTTPServer } from 'http';
import { env } from './env';

let io: SocketIOServer | null = null;

export function initSocket(server: HTTPServer): SocketIOServer {
  io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      credentials: true,
    },
    transports: ['polling', 'websocket'],
  });

  io.on('connection', (socket) => {
    // Join a conversation room (e.g., "conversation_<tenantId>" or "user_<userId>")
    socket.on('join_conversation', (conversationId: string) => {
      if (conversationId) {
        socket.join(`conversation_${conversationId}`);
      }
    });

    socket.on('leave_conversation', (conversationId: string) => {
      if (conversationId) {
        socket.leave(`conversation_${conversationId}`);
      }
    });

    socket.on('join_user', (userId: string) => {
      if (userId) {
        socket.join(`user_${userId}`);
      }
    });
  });

  return io;
}

export function getIO(): SocketIOServer | null {
  return io;
}

export function emitToConversation(conversationId: string, event: string, payload: any) {
  if (io && conversationId) {
    io.to(`conversation_${conversationId}`).emit(event, payload);
    // Also emit to the specific conversation channel directly
    io.emit(event, payload);
  }
}

export function emitGlobal(event: string, payload: any) {
  if (io) {
    io.emit(event, payload);
  }
}
