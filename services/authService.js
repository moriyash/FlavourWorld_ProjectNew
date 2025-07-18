import axios from 'axios';

const API_BASE_URL = 'http://192.168.1.222:3000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, 
});

export const authService = {
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

  login: async (credentials) => {
    try {
      const response = await api.post('/auth/login', credentials);
      console.log(" Server response:", response.data);
      
      if (response.data && response.data.data) {
        const { token, user } = response.data.data;
        
        console.log(" Raw user data from server:", user);
        
        const normalizedUser = {
          id: user?.id || user?._id,
          _id: user?._id || user?.id,
          fullName: user?.fullName || user?.name || user?.displayName,
          name: user?.name || user?.fullName,
          email: user?.email,
          avatar: user?.avatar || user?.userAvatar,
          ...user
        };
        
        console.log(" Normalized user data:", normalizedUser);
        
        return { 
          success: true, 
          data: {
            token,
            user: normalizedUser
          }
        };
      }
      
      if (response.data && response.data.token) {
        return { success: true, data: response.data };
      }
      
      return { success: true, data: response.data };
      
    } catch (error) {      
      if (error.response) {
        const status = error.response.status;
        const errorMessage = error.response.data?.message || '';
        
        if (status === 400 || status === 401) {
          if (errorMessage.includes('Invalid credentials') ||
              errorMessage.includes('Invalid password') || 
              errorMessage.includes('Wrong password') ||
              errorMessage.includes('password') ||
              errorMessage.includes('credentials')) {
            return {
              success: false,
              message: 'Invalid email or password. Please try again.'
            };
          }
          
          if (errorMessage.includes('User not found') || 
              errorMessage.includes('email') ||
              errorMessage.includes('not found')) {
            return {
              success: false,
              message: 'No account found with this email address.'
            };
          }
          
          return {
            success: false,
            message: 'Invalid email or password. Please try again.'
          };
        }
        
        if (status === 403) {
          return {
            success: false,
            message: 'Your account has been suspended. Please contact support.'
          };
        }
        
        if (status === 422) {
          return {
            success: false,
            message: 'Please verify your email address before logging in.'
          };
        }
        
        if (status >= 500) {
          return {
            success: false,
            message: 'Server error. Please try again later.'
          };
        }
        
        return {
          success: false,
          message: errorMessage || 'Login failed. Please try again.'
        };
      }
      
      if (error.request) {
        return {
          success: false,
          message: 'Network error. Please check your connection and try again.'
        };
      }
      
      return {
        success: false,
        message: 'An unexpected error occurred. Please try again.'
      };
    }
  },

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