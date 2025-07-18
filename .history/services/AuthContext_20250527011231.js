const API_BASE_URL = 'http://172.20.10.2:5000/api';

export const authService = {
  // הרשמה
  register: async (userData) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Registration failed');
      }

      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Network error'
      };
    }
  },

  // התחברות
  login: async (credentials) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Network error'
      };
    }
  },

  // שכחת סיסמה
  forgotPassword: async (email) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/forgotpassword`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Password reset failed');
      }

      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Network error'
      };
    }
  }
};
