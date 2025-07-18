import axios from 'axios';

const API_BASE_URL = 'http://192.168.1.222:5000/api';

// יצירת instance של axios עם הגדרות בסיסיות
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

export const recipeService = {
  // יצירת מתכון חדש
  createRecipe: async (recipeData) => {
    try {
      console.log('Creating recipe with data:', recipeData);
      const response = await api.post('/recipes', recipeData);
      console.log('Recipe created successfully:', response.data);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Error creating recipe:', error);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to create recipe'
      };
    }
  },

  // קבלת כל המתכונים
  getAllRecipes: async () => {
    try {
      console.log('Fetching all recipes...');
      const response = await api.get('/recipes');
      console.log('Recipes fetched:', response.data);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Error fetching recipes:', error);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to fetch recipes'
      };
    }
  },

  // קבלת מתכון לפי ID
  getRecipeById: async (recipeId) => {
    try {
      const response = await api.get(`/recipes/${recipeId}`);
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
      const response = await api.put(`/recipes/${recipeId}`, recipeData);
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
      await api.delete(`/recipes/${recipeId}`);
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
      const response = await api.post(`/recipes/${recipeId}/like`);
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
      const response = await api.delete(`/recipes/${recipeId}/like`);
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
      const response = await api.post(`/recipes/${recipeId}/comments`, { text: comment });
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
      await api.delete(`/recipes/${recipeId}/comments/${commentId}`);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to delete comment'
      };
    }
  }
};
