// services/NotificationService.js - גרסה עם axios

import axios from 'axios';

const API_BASE_URL = 'http://192.168.0.101:3000/api'; // 🔧 החלף את זה לכתובת השרת שלך

// Create axios instance for notifications
const notificationClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

class NotificationService {
  
  // קבלת כל ההתראות של המשתמש
  async getUserNotifications(userId) {
    try {
      console.log('📬 Fetching notifications for user:', userId);
      
      const response = await notificationClient.get('/notifications', {
        params: { userId }
      });

      console.log('✅ Notifications fetched successfully:', response.data?.data?.length || 0);
      return {
        success: true,
        data: response.data?.data || []
      };
      
    } catch (error) {
      console.error('❌ Notification fetch error:', error.response?.data || error.message);
      return {
        success: false,
        message: error.response?.data?.message || 'Network error - could not fetch notifications'
      };
    }
  }

  // סימון התראה כנקראה
  async markAsRead(notificationId) {
    try {
      console.log('👁️ Marking notification as read:', notificationId);
      
      const response = await notificationClient.put(`/notifications/${notificationId}/read`);

      console.log('✅ Notification marked as read');
      return {
        success: true,
        data: response.data?.data
      };
      
    } catch (error) {
      console.error('❌ Mark as read error:', error.response?.data || error.message);
      return {
        success: false,
        message: error.response?.data?.message || 'Network error'
      };
    }
  }

  // סימון כל ההתראות כנקראו
  async markAllAsRead(userId) {
    try {
      console.log('👁️ Marking all notifications as read for user:', userId);
      
      const response = await notificationClient.put('/notifications/mark-all-read', {
        userId
      });

      console.log('✅ All notifications marked as read');
      return {
        success: true,
        data: response.data
      };
      
    } catch (error) {
      console.error('❌ Mark all as read error:', error.response?.data || error.message);
      return {
        success: false,
        message: error.response?.data?.message || 'Network error'
      };
    }
  }

  // קבלת מספר התראות לא נקראו
  async getUnreadCount(userId) {
    try {
      const response = await notificationClient.get('/notifications/unread-count', {
        params: { userId }
      });

      return {
        success: true,
        count: response.data?.count || 0
      };
      
    } catch (error) {
      console.error('❌ Get unread count error:', error);
      return {
        success: false,
        count: 0
      };
    }
  }

  // 🆕 פונקציית helper לרענון התראות
  async refreshNotifications(userId, callback) {
    const result = await this.getUserNotifications(userId);
    if (result.success && callback) {
      callback(result.data);
    }
    return result;
  }

  // 🆕 פונקציית helper לרענון counter
  async refreshUnreadCount(userId, callback) {
    const result = await this.getUnreadCount(userId);
    if (result.success && callback) {
      callback(result.count);
    }
    return result;
  }

  // 🆕 מחיקת התראה (אופציונלי - לעתיד)
  async deleteNotification(notificationId) {
    try {
      console.log('🗑️ Deleting notification:', notificationId);
      
      const response = await notificationClient.delete(`/notifications/${notificationId}`);

      console.log('✅ Notification deleted');
      return {
        success: true,
        data: response.data
      };
      
    } catch (error) {
      console.error('❌ Delete notification error:', error.response?.data || error.message);
      return {
        success: false,
        message: error.response?.data?.message || 'Network error'
      };
    }
  }

  // 🆕 מחיקת כל ההתראות (אופציונלי - לעתיד)
  async deleteAllNotifications(userId) {
    try {
      console.log('🗑️ Deleting all notifications for user:', userId);
      
      const response = await notificationClient.delete('/notifications/delete-all', {
        data: { userId }
      });

      console.log('✅ All notifications deleted');
      return {
        success: true,
        data: response.data
      };
      
    } catch (error) {
      console.error('❌ Delete all notifications error:', error.response?.data || error.message);
      return {
        success: false,
        message: error.response?.data?.message || 'Network error'
      };
    }
  }

  // 🆕 פונקציית helper לבדיקה אם יש התראות חדשות
  async hasNewNotifications(userId, lastChecked) {
    try {
      const result = await this.getUserNotifications(userId);
      if (result.success && result.data.length > 0) {
        const latestNotification = result.data[0]; // הראשון ברשימה (הכי חדש)
        const latestTime = new Date(latestNotification.createdAt);
        const lastCheckedTime = new Date(lastChecked);
        
        return {
          success: true,
          hasNew: latestTime > lastCheckedTime,
          latestNotification
        };
      }
      return {
        success: true,
        hasNew: false
      };
    } catch (error) {
      console.error('❌ Check new notifications error:', error);
      return {
        success: false,
        hasNew: false
      };
    }
  }

  // 🆕 פונקציית helper לקבלת סטטיסטיקות התראות
  async getNotificationStats(userId) {
    try {
      const result = await this.getUserNotifications(userId);
      if (result.success) {
        const notifications = result.data;
        const totalCount = notifications.length;
        const unreadCount = notifications.filter(n => !n.read).length;
        const readCount = totalCount - unreadCount;
        
        // סטטיסטיקות לפי סוג
        const typeStats = notifications.reduce((acc, notification) => {
          acc[notification.type] = (acc[notification.type] || 0) + 1;
          return acc;
        }, {});

        return {
          success: true,
          stats: {
            totalCount,
            unreadCount,
            readCount,
            typeBreakdown: typeStats
          }
        };
      }
      return {
        success: false,
        stats: null
      };
    } catch (error) {
      console.error('❌ Get notification stats error:', error);
      return {
        success: false,
        stats: null
      };
    }
  }
}

export const notificationService = new NotificationService();