// services/NotificationService.js

const API_URL = 'http://192.168.0.101:3000'; // 🔧 החלף את זה לכתובת השרת שלך

class NotificationService {
  
  // קבלת כל ההתראות של המשתמש
  async getUserNotifications(userId) {
    try {
      console.log('📬 Fetching notifications for user:', userId);
      
      const response = await fetch(`${API_URL}/api/notifications?userId=${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();
      
      if (response.ok) {
        console.log('✅ Notifications fetched successfully:', result.data?.length || 0);
        return {
          success: true,
          data: result.data || result || []
        };
      } else {
        console.error('❌ Failed to fetch notifications:', result.message);
        return {
          success: false,
          message: result.message || 'Failed to fetch notifications'
        };
      }
    } catch (error) {
      console.error('❌ Notification fetch error:', error);
      return {
        success: false,
        message: 'Network error - could not fetch notifications'
      };
    }
  }

  // סימון התראה כנקראה
  async markAsRead(notificationId) {
    try {
      console.log('👁️ Marking notification as read:', notificationId);
      
      const response = await fetch(`${API_URL}/api/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();
      
      if (response.ok) {
        console.log('✅ Notification marked as read');
        return {
          success: true,
          data: result
        };
      } else {
        console.error('❌ Failed to mark as read:', result.message);
        return {
          success: false,
          message: result.message || 'Failed to mark as read'
        };
      }
    } catch (error) {
      console.error('❌ Mark as read error:', error);
      return {
        success: false,
        message: 'Network error'
      };
    }
  }

  // סימון כל ההתראות כנקראו
  async markAllAsRead(userId) {
    try {
      console.log('👁️ Marking all notifications as read for user:', userId);
      
      const response = await fetch(`${API_URL}/api/notifications/mark-all-read`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId })
      });

      const result = await response.json();
      
      if (response.ok) {
        console.log('✅ All notifications marked as read');
        return {
          success: true,
          data: result
        };
      } else {
        console.error('❌ Failed to mark all as read:', result.message);
        return {
          success: false,
          message: result.message || 'Failed to mark all as read'
        };
      }
    } catch (error) {
      console.error('❌ Mark all as read error:', error);
      return {
        success: false,
        message: 'Network error'
      };
    }
  }

  // יצירת התראת לייק
  async createLikeNotification(fromUserId, fromUserName, toUserId, postId, postTitle) {
    try {
      if (fromUserId === toUserId) {
        // אל תשלח התראה לעצמך
        return { success: true };
      }

      console.log('❤️ Creating like notification:', {
        from: fromUserName,
        to: toUserId,
        post: postTitle
      });

      const response = await fetch(`${API_URL}/api/notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'like',
          fromUserId,
          fromUserName,
          toUserId,
          postId,
          postTitle,
          message: `${fromUserName} liked your recipe "${postTitle}"`
        })
      });

      const result = await response.json();
      
      if (response.ok) {
        console.log('✅ Like notification created');
        return { success: true };
      } else {
        console.error('❌ Failed to create like notification:', result.message);
        return { success: false };
      }
    } catch (error) {
      console.error('❌ Create like notification error:', error);
      return { success: false };
    }
  }

  // יצירת התראת תגובה
  async createCommentNotification(fromUserId, fromUserName, toUserId, postId, postTitle) {
    try {
      if (fromUserId === toUserId) {
        // אל תשלח התראה לעצמך
        return { success: true };
      }

      console.log('💬 Creating comment notification:', {
        from: fromUserName,
        to: toUserId,
        post: postTitle
      });

      const response = await fetch(`${API_URL}/api/notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'comment',
          fromUserId,
          fromUserName,
          toUserId,
          postId,
          postTitle,
          message: `${fromUserName} commented on your recipe "${postTitle}"`
        })
      });

      const result = await response.json();
      
      if (response.ok) {
        console.log('✅ Comment notification created');
        return { success: true };
      } else {
        console.error('❌ Failed to create comment notification:', result.message);
        return { success: false };
      }
    } catch (error) {
      console.error('❌ Create comment notification error:', error);
      return { success: false };
    }
  }

  // יצירת התראת מעקב
  async createFollowNotification(fromUserId, fromUserName, toUserId) {
    try {
      if (fromUserId === toUserId) {
        // אל תשלח התראה לעצמך
        return { success: true };
      }

      console.log('👥 Creating follow notification:', {
        from: fromUserName,
        to: toUserId
      });

      const response = await fetch(`${API_URL}/api/notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'follow',
          fromUserId,
          fromUserName,
          toUserId,
          message: `${fromUserName} started following you`
        })
      });

      const result = await response.json();
      
      if (response.ok) {
        console.log('✅ Follow notification created');
        return { success: true };
      } else {
        console.error('❌ Failed to create follow notification:', result.message);
        return { success: false };
      }
    } catch (error) {
      console.error('❌ Create follow notification error:', error);
      return { success: false };
    }
  }

  // קבלת מספר התראות לא נקראו
  async getUnreadCount(userId) {
    try {
      const response = await fetch(`${API_URL}/api/notifications/unread-count?userId=${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();
      
      if (response.ok) {
        return {
          success: true,
          count: result.count || 0
        };
      } else {
        return {
          success: false,
          count: 0
        };
      }
    } catch (error) {
      console.error('❌ Get unread count error:', error);
      return {
        success: false,
        count: 0
      };
    }
  }
}

export const notificationService = new NotificationService();