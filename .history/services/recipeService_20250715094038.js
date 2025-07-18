import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'http://172.20.10.2:3000/api'; 

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000, 
});

api.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.log('No token found');
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    return Promise.reject(error);
  }
);

export const recipeService = {
  testConnection: async () => {
    try {
      console.log('🔗 Testing server connection...');
      const response = await api.get('/');
      console.log('✅ Server connection successful');
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  getFeed: async (userId) => {
    try {
      console.log('📥 Fetching personalized feed for user:', userId);
      const response = await api.get(`/feed?userId=${userId}`);
      console.log('📥 Feed response:', response.data?.length || 0, 'posts');
      
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to fetch feed'
      };
    }
  },

  getUserGroupsPosts: async (userId) => {
    try {
      console.log('📥 Fetching user groups posts for:', userId);
      const response = await api.get(`/groups/my-posts?userId=${userId}`);
      console.log('📥 Groups posts response:', response.data?.length || 0, 'posts');
      
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to fetch groups posts'
      };
    }
  },

  getFollowingPosts: async (userId) => {
    try {
      console.log('📥 Fetching following posts for user:', userId);
      const response = await api.get(`/following/posts?userId=${userId}`);
      console.log('📥 Following posts response:', response.data?.length || 0, 'posts');
      
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to fetch following posts'
      };
    }
  },

  createRecipe: async (recipeData) => {
    try {
      console.log('📤 Creating recipe on server...', recipeData.title);
      
      if (!recipeData || !recipeData.title) {
        return {
          success: false,
          message: 'Recipe title is required. Please add a title and try again.'
        };
      }

      if (recipeData.image) {
        console.log('📷 Image detected, using FormData...');
        
        const formData = new FormData();
        
        formData.append('title', recipeData.title || '');
        formData.append('description', recipeData.description || '');
        formData.append('ingredients', recipeData.ingredients || '');
        formData.append('instructions', recipeData.instructions || '');
        formData.append('category', recipeData.category || '');
        formData.append('meatType', recipeData.meatType || '');
        formData.append('prepTime', (recipeData.prepTime || 0).toString());
        formData.append('servings', (recipeData.servings || 1).toString());
        formData.append('userId', recipeData.userId || '');
        formData.append('userName', recipeData.userName || '');
        formData.append('userAvatar', recipeData.userAvatar || '');
        
        formData.append('image', {
          uri: recipeData.image,
          type: 'image/jpeg',
          name: 'recipe.jpg',
        });

        const response = await api.post('/recipes', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          timeout: 120000, 
          onUploadProgress: (progressEvent) => {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            console.log(`📊 Upload progress: ${progress}%`);
          }
        });

        console.log('✅ Recipe with image uploaded successfully!');
        return { success: true, data: response.data };

      } else {
        console.log('📝 No image, using JSON...');
        
        const jsonData = {
          title: recipeData.title,
          description: recipeData.description,
          ingredients: recipeData.ingredients,
          instructions: recipeData.instructions,
          category: recipeData.category,
          meatType: recipeData.meatType,
          prepTime: recipeData.prepTime || 0,
          servings: recipeData.servings || 1,
          userId: recipeData.userId || '',
          userName: recipeData.userName || '',
          userAvatar: recipeData.userAvatar || null
        };

        console.log('📤 Sending JSON data:', jsonData);

        const response = await api.post('/recipes', jsonData, {
          headers: {
            'Content-Type': 'application/json',
          },
        });

        console.log('✅ Recipe without image uploaded successfully!');
        return { success: true, data: response.data };
      }

    } catch (error) {
      
      let errorMessage = 'Failed to create recipe';
      
      if (error.response) {
        errorMessage = error.response.data?.message || `Server error: ${error.response.status}`;
      } else if (error.request) {
        errorMessage = 'No response from server. Check your connection.';
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = 'Upload took too long. Please try again.';
      } else {
        errorMessage = error.message || 'Unknown error occurred';
      }
      
      return {
        success: false,
        message: errorMessage,
        details: error.response?.data
      };
    }
  },

  getAllRecipes: async (userId = null) => {
    try {
      if (userId) {
        console.log('📥 Fetching personalized feed...');
        const result = await recipeService.getFeed(userId);
        return result;
      } else {
        console.log('📥 Fetching all recipes from server...');
        const response = await api.get('/recipes');
        console.log('📥 Server response:', response.data?.length || 0, 'recipes');
        
        return { success: true, data: response.data };
      }
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to fetch recipes'
      };
    }
  },

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

  updateRecipe: async (recipeId, updateData, imageUri = null) => {
    try {
      console.log('🔄 Updating recipe...', recipeId);
      console.log('📝 Update data:', updateData);
      
      const formData = new FormData();
      
      formData.append('title', updateData.title || '');
      formData.append('description', updateData.description || '');
      formData.append('ingredients', updateData.ingredients || '');
      formData.append('instructions', updateData.instructions || '');
      formData.append('category', updateData.category || 'General');
      formData.append('meatType', updateData.meatType || 'Mixed');
      formData.append('prepTime', updateData.prepTime?.toString() || '0');
      formData.append('servings', updateData.servings?.toString() || '1');
      formData.append('userId', updateData.userId || '');

      if (imageUri) {
        console.log('📷 Adding new image to update');
        formData.append('image', {
          uri: imageUri,
          type: 'image/jpeg',
          name: 'recipe-image.jpg',
        });
      } else if (updateData.image) {
        console.log('📷 Keeping existing image');
        formData.append('image', updateData.image);
      }

      const response = await api.put(`/recipes/${recipeId}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 120000,
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          console.log(`📊 Update progress: ${progress}%`);
        }
      });

      console.log('✅ Recipe updated successfully');
      return {
        success: true,
        data: response.data
      };

    } catch (error) {
      
      let errorMessage = 'Failed to update recipe';
      
      if (error.response) {
        errorMessage = error.response.data?.message || `Server error: ${error.response.status}`;
      } else if (error.request) {
        errorMessage = 'No response from server. Check your connection.';
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = 'Update took too long. Please try again.';
      } else {
        errorMessage = error.message || 'Unknown error occurred';
      }
      
      return {
        success: false,
        message: errorMessage,
        details: error.response?.data
      };
    }
  },

  deleteRecipe: async (recipeId, postData = null) => {
  try {
    console.log('🗑️ Deleting recipe from server:', recipeId);
    console.log('📝 Post data:', postData);
    
    if (postData && postData.groupId) {
      console.log('🏢 Deleting group post via groupService...');
      
      const result = await groupService.deleteGroupPost(
        postData.groupId, 
        recipeId, 
        postData.userId || postData.authorId
      );
      
      if (result.success) {
        console.log('✅ Group post deleted successfully');
        return { success: true };
      } else {
        return {
          success: false,
          message: result.message || 'Failed to delete group post'
        };
      }
    }
    
    if (postData && (postData.isGroupPost || postData.group)) {
      const groupId = postData.group?._id || postData.group?.id || postData.groupId;
      
      if (groupId) {
        console.log('🏢 Detected group post, using group endpoint...');
        
        try {
          await api.delete(`/groups/${groupId}/posts/${recipeId}`);
          console.log('✅ Group post deleted via direct API call');
          return { success: true };
        } catch (groupError) {
          console.warn('⚠️ Group endpoint failed, trying regular endpoint...', groupError.message);
        }
      }
    }
    
    console.log('📝 Deleting regular post...');
    await api.delete(`/recipes/${recipeId}`);
    console.log('✅ Regular post deleted successfully');
    return { success: true };
    
  } catch (error) {
    
    if (error.response) {
      const status = error.response.status;
      const errorMessage = error.response.data?.message || '';
      
      if (status === 403) {
        return {
          success: false,
          message: 'You are not authorized to delete this post'
        };
      }
      
      if (status === 404) {
        return {
          success: false,
          message: 'Post not found or already deleted'
        };
      }
      
      return {
        success: false,
        message: errorMessage || 'Failed to delete post'
      };
    }
    
    return {
      success: false,
      message: 'Network error. Please check your connection and try again.'
    };
  }
},

  deletePost: async (postId, postData) => {
    try {
      console.log('🗑️ Auto-detecting post type for deletion:', postId);
      
      const isGroupPost = postData && (
        postData.groupId || 
        postData.group || 
        postData.isGroupPost ||
        postData.type === 'group' ||
        postData.postType === 'group'
      );
      
      if (isGroupPost) {
        console.log('🏢 Identified as group post');
        const groupId = postData.groupId || postData.group?._id || postData.group?.id;
        const userId = postData.userId || postData.authorId || postData.author?._id;
        
        if (!groupId) {
          return {
            success: false,
            message: 'Unable to delete group post. Missing group information.'
          };
        }
        
        const result = await groupService.deleteGroupPost(groupId, postId, userId);
        return result;
      } else {
        console.log('📝 Identified as regular post');
        await api.delete(`/recipes/${postId}`);
        return { success: true };
      }
      
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to delete post'
      };
    }
  },

  likeRecipe: async (recipeId, userId) => {
    try {
      console.log('👍 Liking recipe on server:', recipeId, 'by user:', userId);
      const response = await api.post(`/recipes/${recipeId}/like`, {
        userId: userId 
      });
      console.log('✅ Like response:', response.data);
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to like recipe'
      };
    }
  },

  unlikeRecipe: async (recipeId, userId) => {
    try {
      console.log('👎 Unliking recipe on server:', recipeId, 'by user:', userId);
      const response = await api.delete(`/recipes/${recipeId}/like`, {
        data: { userId: userId } 
      });
      console.log('✅ Unlike response:', response.data);
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to unlike recipe'
      };
    }
  },

  addComment: async (recipeId, commentData) => {
    try {
      console.log('💬 Adding comment to server:', recipeId);
      const response = await api.post(`/recipes/${recipeId}/comments`, {
        text: commentData.text,
        userId: commentData.userId,
        userName: commentData.userName,
        userAvatar: commentData.userAvatar
      });
      
      return { 
        success: true, 
        data: response.data.data || response.data 
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to add comment'
      };
    }
  },

  deleteComment: async (recipeId, commentId) => {
    try {
      console.log('🗑️ Deleting comment from server:', commentId);
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