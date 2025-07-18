// services/chatServices.js - מתוקן לשרת שלך

import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const API_BASE_URL = 'http://192.168.0.101:3000/api';

// Create axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Failed to get token:', error);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.log('Axios Error Response:', error.response?.status, error.response?.data);
    if (error.response?.status === 401) {
      AsyncStorage.multiRemove(['userToken', 'userId']);
    }
    return Promise.reject(error);
  }
);

class ChatService {
  constructor() {
    this.currentUser = null;
    this.messageListeners = [];
    this.onlineUsersListeners = [];
    this.typingListeners = [];
    this.notificationListeners = [];
  }

  async initializeSocket(userId) {
    try {
      this.currentUser = userId;
      console.log('💬 Chat service initialized for user:', userId);
      this.startNotificationPolling();
      return true;
    } catch (error) {
      console.error('❌ Chat service initialization error:', error);
      return false;
    }
  }

  disconnect() {
    console.log('💬 Chat service disconnected');
    this.stopNotificationPolling();
    this.messageListeners = [];
    this.onlineUsersListeners = [];
    this.typingListeners = [];
    this.notificationListeners = [];
  }

  startNotificationPolling() {
    if (this.notificationInterval) {
      clearInterval(this.notificationInterval);
    }
    
    this.notificationInterval = setInterval(async () => {
      try {
        const result = await this.getUnreadCount();
        if (result.success) {
          this.notificationListeners.forEach(callback => {
            callback(result.count);
          });
        }
      } catch (error) {
        console.error('Notification polling error:', error);
      }
    }, 30000);
  }

  stopNotificationPolling() {
    if (this.notificationInterval) {
      clearInterval(this.notificationInterval);
      this.notificationInterval = null;
    }
  }

  // Event listeners
  onMessage(callback) {
    this.messageListeners.push(callback);
    return () => {
      this.messageListeners = this.messageListeners.filter(cb => cb !== callback);
    };
  }

  onOnlineUsers(callback) {
    this.onlineUsersListeners.push(callback);
    return () => {
      this.onlineUsersListeners = this.onlineUsersListeners.filter(cb => cb !== callback);
    };
  }

  onTyping(callback) {
    this.typingListeners.push(callback);
    return () => {
      this.typingListeners = this.typingListeners.filter(cb => cb !== callback);
    };
  }

  onNotification(callback) {
    this.notificationListeners.push(callback);
    return () => {
      this.notificationListeners = this.notificationListeners.filter(cb => cb !== callback);
    };
  }

  // ========== FOLLOW FUNCTIONS ==========
  
  async getFollowStatus(userId, currentUserId) {
    try {
      console.log('👥 Getting follow status:', userId, currentUserId);
      
      const response = await apiClient.get(`/users/${userId}/follow-status/${currentUserId}`);
      
      console.log('✅ Follow status response:', response.data);
      return { success: true, data: response.data };
      
    } catch (error) {
      console.error('❌ Get follow status error:', error.response?.status, error.response?.data);
      return { 
        success: false, 
        message: error.response?.data?.message || error.message 
      };
    }
  }

  async toggleFollow(userId, followerId, isFollowing) {
    try {
      console.log('👥 Toggle follow:', userId, followerId, isFollowing);
      
      if (!userId || !followerId) {
        throw new Error('Missing userId or followerId');
      }
      
      if (userId === followerId) {
        throw new Error('Cannot follow yourself');
      }

      let response;
      
      if (isFollowing) {
        console.log('🔄 Sending DELETE request to unfollow...');
        response = await apiClient.delete(`/users/${userId}/follow`, {
          data: { followerId: followerId }
        });
      } else {
        console.log('🔄 Sending POST request to follow...');
        response = await apiClient.post(`/users/${userId}/follow`, {
          followerId: followerId
        });
      }
      
      console.log('✅ Toggle follow success:', response.data);
      return { success: true, data: response.data };
      
    } catch (error) {
      console.error('❌ Toggle follow error:', error.response?.status, error.response?.data);
      
      if (error.response?.status === 400) {
        const errorMsg = error.response.data?.message;
        if (errorMsg?.includes('Already following')) {
          return { success: false, message: 'You are already following this user' };
        }
        if (errorMsg?.includes('Not following')) {
          return { success: false, message: 'You are not following this user' };
        }
        if (errorMsg?.includes('Cannot follow yourself')) {
          return { success: false, message: 'You cannot follow yourself' };
        }
      }
      
      if (error.response?.status === 404) {
        return { success: false, message: 'User not found' };
      }
      
      if (error.response?.status === 503) {
        return { success: false, message: 'Database not available. Please try again later.' };
      }
      
      return { 
        success: false, 
        message: error.response?.data?.message || 'Failed to update follow status' 
      };
    }
  }

  async getFollowers(userId, page = 1, limit = 20) {
    try {
      console.log('👥 Getting followers for:', userId);
      console.log('⚠️ Note: Followers list endpoint not implemented in your server yet');
      
      return { 
        success: true, 
        data: [],
        message: 'Followers list feature will be available soon!' 
      };
      
    } catch (error) {
      console.error('❌ Get followers error:', error);
      return { 
        success: false, 
        message: error.response?.data?.message || error.message 
      };
    }
  }

  async getFollowing(userId, page = 1, limit = 20) {
    try {
      console.log('👥 Getting following for:', userId);
      console.log('⚠️ Note: Following list endpoint not implemented in your server yet');
      
      return { 
        success: true, 
        data: [],
        message: 'Following list feature will be available soon!' 
      };
      
    } catch (error) {
      console.error('❌ Get following error:', error);
      return { 
        success: false, 
        message: error.response?.data?.message || error.message 
      };
    }
  }

  // ========== CHAT FUNCTIONS - מתוקן לשרת שלך ==========

  // יצירת או קבלת צ'אט פרטי - מתוקן לשרת שלך
  async getOrCreatePrivateChat(otherUserId) {
    try {
      console.log('💬 === STARTING CHAT CREATION ===');
      console.log('Other User ID:', otherUserId);
      console.log('Current User ID:', this.currentUser);
      
      const currentUserId = this.currentUser;
      
      if (!currentUserId) {
        throw new Error('User not initialized');
      }

      if (!otherUserId) {
        throw new Error('Other user ID is missing');
      }

      if (currentUserId === otherUserId) {
        throw new Error('Cannot create chat with yourself');
      }

      // השרת שלך מצפה רק ל-otherUserId ו-x-user-id header
      console.log('🔄 Creating/Getting private chat...');
      console.log('Request URL:', `${apiClient.defaults.baseURL}/chats/private`);
      console.log('Request payload:', { otherUserId });
      console.log('Headers:', { 'x-user-id': currentUserId });
      
      const response = await apiClient.post('/chats/private', 
        { otherUserId }, // 🔧 השרת שלך מצפה רק לזה
        {
          headers: { 
            'x-user-id': currentUserId // 🔧 השרת שלך צריך את זה
          }
        }
      );

      console.log('✅ Chat creation response status:', response.status);
      console.log('✅ Chat creation response data:', response.data);
      console.log('✅ Private chat ready:', response.data._id);
      
      return { success: true, data: response.data };

    } catch (error) {
      console.error('❌ Get/Create private chat error:');
      console.error('  Status:', error.response?.status);
      console.error('  Data:', error.response?.data);
      console.error('  URL:', error.config?.url);
      console.error('  Method:', error.config?.method);
      console.error('  Request payload:', error.config?.data);
      console.error('  Headers:', error.config?.headers);
      
      // שגיאות ספציפיות מהשרת שלך
      if (error.response?.status === 400) {
        const errorMsg = error.response.data?.message;
        if (errorMsg?.includes('Cannot chat with yourself')) {
          return { success: false, message: 'You cannot chat with yourself' };
        }
        if (errorMsg?.includes('Other user ID is required')) {
          return { success: false, message: 'User ID is missing' };
        }
      }
      
      if (error.response?.status === 404) {
        return { success: false, message: 'User not found' };
      }
      
      if (error.response?.status === 503) {
        return { success: false, message: 'Database not available. Please try again later.' };
      }
      
      return { 
        success: false, 
        message: error.response?.data?.message || 'Failed to create chat'
      };
    }
  }

  // קבלת כל הצ'אטים של המשתמש
  async getMyChats() {
    try {
      console.log('💬 Fetching my chats...');
    
      const response = await apiClient.get('/chats/my', {
        headers: { 'x-user-id': this.currentUser }
      });

      console.log('✅ My chats fetched:', response.data.length);
      return { success: true, data: response.data };

    } catch (error) {
      console.error('❌ Fetch my chats error:', error.response?.status, error.response?.data);
      return { 
        success: false, 
        message: error.response?.data?.message || error.message 
      };
    }
  }

  // קבלת הודעות של צ'אט ספציפי
  async getChatMessages(chatId, page = 1, limit = 50) {
    try {
      console.log('💬 Fetching chat messages:', chatId);
      
      const response = await apiClient.get(`/chats/${chatId}/messages`, {
        params: { page, limit },
        headers: { 'x-user-id': this.currentUser }
      });

      console.log('✅ Chat messages fetched:', response.data.length);
      return { success: true, data: response.data };

    } catch (error) {
      console.error('❌ Fetch chat messages error:', error.response?.status, error.response?.data);
      return { 
        success: false, 
        message: error.response?.data?.message || error.message 
      };
    }
  }

  // שליחת הודעה
  async sendMessage(chatId, content, messageType = 'text') {
    try {
      console.log('💬 Sending message to chat:', chatId, 'Type:', messageType);
      
      let messageContent = content;
      
      if (messageType === 'image') {
        messageContent = content;
      } else if (messageType === 'document') {
        messageContent = content;
      } else if (messageType === 'location') {
        messageContent = content;
      }

      const response = await apiClient.post(`/chats/${chatId}/messages`, {
        content: messageContent,
        messageType,
      }, {
        headers: { 'x-user-id': this.currentUser }
      });

      console.log('✅ Message sent successfully');
      
      // Notify listeners about new message
      this.messageListeners.forEach(callback => {
        callback(response.data);
      });
      
      return { success: true, data: response.data };

    } catch (error) {
      console.error('❌ Send message error:', error.response?.status, error.response?.data);
      return { 
        success: false, 
        message: error.response?.data?.message || error.message 
      };
    }
  }

  // שליחת תמונה
  async sendImage(chatId, imageUri) {
    try {
      console.log('📷 Sending image to chat:', chatId);
      return await this.sendMessage(chatId, imageUri, 'image');
    } catch (error) {
      console.error('❌ Send image error:', error);
      return { success: false, message: error.message };
    }
  }

  // שליחת קובץ
  async sendDocument(chatId, documentData) {
    try {
      console.log('📎 Sending document to chat:', chatId);
      
      const documentString = typeof documentData === 'string' 
        ? documentData 
        : JSON.stringify(documentData);
      
      return await this.sendMessage(chatId, documentString, 'document');
    } catch (error) {
      console.error('❌ Send document error:', error);
      return { success: false, message: error.message };
    }
  }

  // שליחת מיקום
  async sendLocation(chatId, latitude, longitude, address = '') {
    try {
      console.log('📍 Sending location to chat:', chatId);
      
      const locationData = JSON.stringify({
        latitude,
        longitude,
        address,
        timestamp: new Date().toISOString()
      });
      
      return await this.sendMessage(chatId, locationData, 'location');
    } catch (error) {
      console.error('❌ Send location error:', error);
      return { success: false, message: error.message };
    }
  }

  // סימון הודעות כנקראו
  async markAsRead(chatId) {
    try {
      await apiClient.put(`/chats/${chatId}/read`, {}, {
        headers: { 'x-user-id': this.currentUser }
      });

      console.log('✅ Messages marked as read');
      return { success: true };

    } catch (error) {
      console.error('❌ Mark as read error:', error.response?.status, error.response?.data);
      return { 
        success: false, 
        message: error.response?.data?.message || error.message 
      };
    }
  }

  // הצגת סטטוס הקלדה
  startTyping(chatId) {
    console.log('⌨️ User started typing in chat:', chatId);
  }

  stopTyping(chatId) {
    console.log('⌨️ User stopped typing in chat:', chatId);
  }

  // קבלת מספר הודעות לא נקראו
  async getUnreadCount() {
    try {
      const response = await apiClient.get('/chats/unread-count', {
        headers: { 'x-user-id': this.currentUser }
      });

      return { success: true, count: response.data.count };

    } catch (error) {
      console.error('❌ Get unread count error:', error);
      return { success: false, count: 0 };
    }
  }

  // קבלת מספר צ'אטים עם הודעות לא נקראות
  async getUnreadChatsCount() {
    try {
      const result = await this.getMyChats();
      if (result.success) {
        const unreadChatsCount = result.data.filter(chat => chat.unreadCount > 0).length;
        return { success: true, count: unreadChatsCount };
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('❌ Get unread chats count error:', error);
      return { success: false, count: 0 };
    }
  }

  // חיפוש משתמשים
  async searchUsers(query) {
    try {
      console.log('🔍 Searching users:', query);
      
      const response = await apiClient.get('/users/search', {
        params: { q: query },
        headers: { 'x-user-id': this.currentUser }
      });

      console.log('✅ Users search completed:', response.data.length);
      return { success: true, data: response.data };

    } catch (error) {
      console.error('❌ Search users error:', error);
      return { 
        success: false, 
        message: error.response?.data?.message || error.message 
      };
    }
  }

  // מחיקת הודעה
  async deleteMessage(chatId, messageId) {
    try {
      console.log('🗑️ Deleting message:', messageId);
      
      await apiClient.delete(`/chats/${chatId}/messages/${messageId}`, {
        headers: { 'x-user-id': this.currentUser }
      });

      console.log('✅ Message deleted successfully');
      return { success: true };

    } catch (error) {
      console.error('❌ Delete message error:', error);
      return { 
        success: false, 
        message: error.response?.data?.message || error.message 
      };
    }
  }

  // עריכת הודעה
  async editMessage(chatId, messageId, newContent) {
    try {
      console.log('✏️ Editing message:', messageId);
      
      const response = await apiClient.put(`/chats/${chatId}/messages/${messageId}`, {
        content: newContent,
      }, {
        headers: { 'x-user-id': this.currentUser }
      });

      console.log('✅ Message edited successfully');
      return { success: true, data: response.data };

    } catch (error) {
      console.error('❌ Edit message error:', error);
      return { 
        success: false, 
        message: error.response?.data?.message || error.message 
      };
    }
  }

  // העלאת קובץ לשרת
  async uploadFile(file) {
    try {
      console.log('📤 Uploading file:', file.name);
      
      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        type: file.type,
        name: file.name,
      });

      const response = await apiClient.post('/upload/file', formData, {
        headers: {
          'x-user-id': this.currentUser,
          'Content-Type': 'multipart/form-data',
        },
      });

      console.log('✅ File uploaded successfully');
      return { success: true, data: response.data };

    } catch (error) {
      console.error('❌ Upload file error:', error);
      return { 
        success: false, 
        message: error.response?.data?.message || error.message 
      };
    }
    
  }
  
  

  // Helper Functions
  formatMessageTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'now';
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return 'yesterday';
    if (diffInDays < 7) return `${diffInDays}d`;
    
    return date.toLocaleDateString('en-US');
  }

  isToday(dateString) {
    const date = new Date(dateString);
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }

  getMessagePreview(message, maxLength = 50) {
    if (!message) return 'Start a conversation...';
    
    switch (message.messageType) {
      case 'image':
        return '📷 Image';
      case 'document':
        return '📎 File';
      case 'location':
        return '📍 Location';
      case 'audio':
        return '🎵 Voice message';
      case 'video':
        return '🎥 Video';
      default:
        const content = message.content || 'Message';
        return content.length > maxLength 
          ? content.substring(0, maxLength) + '...' 
          : content;
    }
  }
  
}

export const chatService = new ChatService();