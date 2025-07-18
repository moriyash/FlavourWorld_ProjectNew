import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'http://172.20.10.2:5000/api';

// יצירת instance של axios עם הגדרות בסיסיות
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Interceptor להוספת token לכל בקשה
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('userToken');
    if (token) {
      config.headers.Authorization = Bearer ${token};
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export const recipeService = {
  // יצירת מתכון חדש
  createRecipe: async (recipeData) => {
    try {
      const formData = new FormData();
      
      // הוספת נתוני המתכון
      formData.append('title', recipeData.title);
      formData.append('description', recipeData.description);
      formData.append('ingredients', recipeData.ingredients);
      formData.append('instructions', recipeData.instructions);
      formData.append('category', recipeData.category);
      formData.append('meatType', recipeData.meatType);
      formData.append('prepTime', recipeData.prepTime.toString());
      formData.append('servings', recipeData.servings.toString());

      // הוספת תמונה אם קיימת
      if (recipeData.image) {
        formData.append('image', {
          uri: recipeData.image.uri,
          type: 'image/jpeg',
          name: 'recipe.jpg',
        });
      }

      const response = await api.post('/recipes', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to create recipe'
      };
    }
  },

  // קבלת כל המתכונים
  getAllRecipes: async () => {
    try {
      const response = await api.get('/recipes');
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to fetch recipes'
      };
    }
  },

  // קבלת מתכון לפי ID
  getRecipeById: async (recipeId) => {
    try {
      const response = await api.get(/recipes/${recipeId});
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to fetch recipe'
      };
    }
  },

  // עדכון מתכון
  updateRecipe: async (recipeId, recipeData) => {
    try {
      const response = await api.put(/recipes/${recipeId}, recipeData);
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to update recipe'
      };
    }
  },

  // מחיקת מתכון
  deleteRecipe: async (recipeId) => {
    try {
      await api.delete(/recipes/${recipeId});
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to delete recipe'
      };
    }
  },

  // הוספת לייק למתכון
  likeRecipe: async (recipeId) => {
    try {
      const response = await api.post(/recipes/${recipeId}/like);
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to like recipe'
      };
    }
  },

  // הסרת לייק מהמתכון
  unlikeRecipe: async (recipeId) => {
    try {
      const response = await api.delete(/recipes/${recipeId}/like);
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to unlike recipe'
      };
    }
  },

  // הוספת תגובה למתכון
  addComment: async (recipeId, comment) => {
    try {
      const response = await api.post(/recipes/${recipeId}/comments, { text: comment });
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to add comment'
      };
    }
  },

  // מחיקת תגובה
  deleteComment: async (recipeId, commentId) => {
    try {
      await api.delete(/recipes/${recipeId}/comments/${commentId});
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to delete comment'
     };}
}
};