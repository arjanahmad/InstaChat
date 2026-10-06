/**
 * INSTAChat Realtime Socket Client (Socket.IO)
 * Zero-quota real-time communication engine for Instant Messaging,
 * WebRTC Signaling, Presence, Typing Indicators, and Multiplayer Games.
 */

import { io } from 'socket.io-client';

const SOCKET_SERVER_URL = import.meta.env.VITE_BACKEND_URL || window.location.origin;

class RealtimeSocketManager {
  constructor() {
    this.socket = null;
    this.currentUserId = null;
    this.listeners = new Map(); // event -> Set of callbacks
    this.isConnected = false;
  }

  init(userId) {
    if (this.socket && this.currentUserId === userId) {
      return this.socket;
    }

    if (this.socket) {
      this.socket.disconnect();
    }

    this.currentUserId = userId;
    this.socket = io(SOCKET_SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    this.socket.on('connect', () => {
      this.isConnected = true;
      console.log('[RealtimeSocket] Connected to server with ID:', this.socket.id);
      if (this.currentUserId) {
        this.socket.emit('auth:register', { userId: this.currentUserId });
      }
    });

    this.socket.on('disconnect', (reason) => {
      this.isConnected = false;
      console.log('[RealtimeSocket] Disconnected:', reason);
    });

    this.socket.on('reconnect', () => {
      console.log('[RealtimeSocket] Reconnected successfully');
      if (this.currentUserId) {
        this.socket.emit('auth:register', { userId: this.currentUserId });
      }
    });

    // Rebind any existing subscribers
    for (const [event, callbacks] of this.listeners.entries()) {
      this.socket.off(event);
      this.socket.on(event, (data) => {
        callbacks.forEach((cb) => {
          try {
            cb(data);
          } catch (e) {
            console.error(`Error in socket listener for ${event}:`, e);
          }
        });
      });
    }

    return this.socket;
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
      if (this.socket) {
        this.socket.on(event, (data) => {
          const cbs = this.listeners.get(event);
          if (cbs) {
            cbs.forEach((cb) => {
              try {
                cb(data);
              } catch (e) {
                console.error(`Error in listener for ${event}:`, e);
              }
            });
          }
        });
      }
    }
    this.listeners.get(event).add(callback);

    // Return unsubscribe function
    return () => {
      const cbs = this.listeners.get(event);
      if (cbs) {
        cbs.delete(callback);
        if (cbs.size === 0) {
          this.listeners.delete(event);
          if (this.socket) {
            this.socket.off(event);
          }
        }
      }
    };
  }

  emit(event, data) {
    if (this.socket && this.socket.connected) {
      this.socket.emit(event, data);
    } else {
      // If momentarily reconnecting, wait for connect
      if (this.socket) {
        this.socket.once('connect', () => {
          this.socket.emit(event, data);
        });
      }
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.currentUserId = null;
    this.isConnected = false;
  }
}

export const realtimeSocket = new RealtimeSocketManager();
