// בקובץ authService.js - תיקון פונקציית ההתחברות:

import axios from 'axios';

const API_BASE_URL = 'http://192.168.0.101:3000/api';

// יצירת instance של axios עם הגדרות בסיסיות
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 שניות timeout
});

export const authService = {
  // הרשמה
  register: async (userData) => {
    try {
      const response = await api.post('/auth/register', userData);
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Network error'
      };
    }
  },

  // התחברות
  login: async (credentials) => {
    try {
      const response = await api.post('/auth/login', credentials);
      console.log("📦 Server response:", response.data);
      
      // 🔧 תיקון: השרת מחזיר response.data.data במקום response.data
      if (response.data && response.data.data) {
        const { token, user } = response.data.data;
        
        console.log("🔍 Raw user data from server:", user);
        
        // הכן את מידע המשתמש במבנה אחיד
        const normalizedUser = {
          id: user?.id || user?._id,
          _id: user?._id || user?.id,
          fullName: user?.fullName || user?.name || user?.displayName,
          name: user?.name || user?.fullName,
          email: user?.email,
          avatar: user?.avatar || user?.userAvatar,
          // שמור את כל הנתונים המקוריים
          ...user
        };
        
        console.log("🔧 Normalized user data:", normalizedUser);
        
        return { 
          success: true, 
          data: {
            token,
            user: normalizedUser
          }
        };
      }
      
      // 🔧 פתרון חלופי: אם המבנה שונה
      if (response.data && response.data.token) {
        return { success: true, data: response.data };
      }
      
      // 🔧 פתרון נוסף: אם המבנה הוא ישיר
      return { success: true, data: response.data };
      
    } catch (error) {
      console.error("❌ Login error:", error);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Network error'
      };
    }
  },

  // שכחת סיסמה
  forgotPassword: async (email) => {
    try {
      const response = await api.post('/auth/forgotpassword', { email });
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Network error'
      };
    }
  }
};