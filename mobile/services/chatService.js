import { io } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import baseURL from './baseUrl';

// Extract base URL without /api/v1
const getSocketURL = () => {
  const url = baseURL.replace('/api/v1', '');
  return url;
};

let socket = null;
let connectionRetries = 0;
const MAX_RETRIES = 5;

/**
 * Initialize Socket.IO connection
 * Returns only after the socket is actually connected.
 */
export const initializeSocket = async () => {
  try {
    if (socket && socket.connected) {
      console.log('Socket already connected');
      return socket;
    }

    const token = await SecureStore.getItemAsync('auth_token');
    const socketURL = getSocketURL();
    
    console.log('Connecting to socket:', socketURL);

    socket = io(socketURL, {
      transports: ['websocket', 'polling'],
      auth: {
        token: token
      },
      reconnection: true,
      reconnectionAttempts: MAX_RETRIES,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
      connectionRetries = 0;
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);
      connectionRetries++;
      if (connectionRetries >= MAX_RETRIES) {
        console.log('Max connection retries reached');
      }
    });

    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    // Wait for the socket to be actually connected before returning.
    // Without this, joinConversation() is called while socket.connected is
    // still false, so the room-join is silently skipped and no live events
    // are received.
    if (!socket.connected) {
      await new Promise((resolve) => {
        socket.once('connect', resolve);
        // Safety timeout: resolve anyway after 10 s so the screen doesn't hang
        setTimeout(resolve, 10000);
      });
    }

    return socket;
  } catch (error) {
    console.error('Error initializing socket:', error);
    return null;
  }
};

/**
 * Get socket instance
 */
export const getSocket = () => {
  return socket;
};

/**
 * Disconnect socket
 */
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    console.log('Socket disconnected');
  }
};

/**
 * Join a conversation room
 */
export const joinConversation = (conversationId, userRole) => {
  if (!socket) return;
  const doJoin = () => {
    socket.emit('join_conversation', {
      conversation_id: conversationId,
      user_role: userRole
    });
    console.log('Joined conversation room:', conversationId);
  };
  if (socket.connected) {
    doJoin();
  } else {
    socket.once('connect', doJoin);
  }
};

/**
 * Leave a conversation room
 */
export const leaveConversation = (conversationId) => {
  if (socket && socket.connected) {
    socket.emit('leave_conversation', {
      conversation_id: conversationId
    });
  }
};

/**
 * Send a message via socket
 */
export const sendMessage = (conversationId, senderId, senderRole, content, messageType = 'text') => {
  if (socket && socket.connected) {
    socket.emit('send_message', {
      conversation_id: conversationId,
      sender_id: senderId,
      sender_role: senderRole,
      content: content,
      message_type: messageType
    });
    return true;
  }
  return false;
};

/**
 * Send typing indicator
 */
export const sendTypingIndicator = (conversationId, userRole, isTyping) => {
  if (socket && socket.connected) {
    socket.emit('typing', {
      conversation_id: conversationId,
      user_role: userRole,
      is_typing: isTyping
    });
  }
};

/**
 * Mark messages as read
 */
export const markMessagesRead = (conversationId, readerRole) => {
  if (socket && socket.connected) {
    socket.emit('mark_read', {
      conversation_id: conversationId,
      reader_role: readerRole
    });
  }
};

/**
 * Subscribe to new messages
 */
export const onNewMessage = (callback) => {
  if (socket) {
    socket.on('new_message', callback);
  }
};

/**
 * Subscribe to typing indicator
 */
export const onTyping = (callback) => {
  if (socket) {
    socket.on('user_typing', callback);
  }
};

/**
 * Subscribe to messages read event
 */
export const onMessagesRead = (callback) => {
  if (socket) {
    socket.on('messages_read', callback);
  }
};

/**
 * Remove listener
 */
export const removeListener = (event) => {
  if (socket) {
    socket.off(event);
  }
};

/**
 * Remove all listeners
 */
export const removeAllListeners = () => {
  if (socket) {
    socket.off('new_message');
    socket.off('user_typing');
    socket.off('messages_read');
  }
};

export default {
  initializeSocket,
  getSocket,
  disconnectSocket,
  joinConversation,
  leaveConversation,
  sendMessage,
  sendTypingIndicator,
  markMessagesRead,
  onNewMessage,
  onTyping,
  onMessagesRead,
  removeListener,
  removeAllListeners
};
