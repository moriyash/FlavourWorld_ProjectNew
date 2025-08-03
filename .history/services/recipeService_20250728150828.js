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
      console.log(' Testing server connection...');
      const response = await api.get('/');
      console.log(' Server connection successful');
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  getFeed: async (userId) => {
    try {
      console.log(' Fetching personalized feed for user:', userId);
      const response = await api.get(`/feed?userId=${userId}`);
      console.log(' Feed response:', response.data?.length || 0, 'posts');
      
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
      console.log(' Fetching user groups posts for:', userId);
      const response = await api.get(`/groups/my-posts?userId=${userId}`);
      console.log(' Groups posts response:', response.data?.length || 0, 'posts');
      
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
      console.log(' Fetching following posts for user:', userId);
      const response = await api.get(`/following/posts?userId=${userId}`);
      console.log(' Following posts response:', response.data?.length || 0, 'posts');
      
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
    console.log('🍳 Creating recipe on server...', recipeData.title);
    
    if (!recipeData || !recipeData.title) {
      return {
        success: false,
        message: 'Recipe title is required. Please add a title and try again.'
      };
    }

    // 🔧 בדיקה מפורטת של נתוני המשתמש
    if (!recipeData.userId) {
      console.error('❌ No userId provided');
      return {
        success: false,
        message: 'User information is missing. Please try logging in again.'
      };
    }

    // 🆕 בדיקה למדיה (תמונה או וידאו)
    const hasMedia = recipeData.media || recipeData.image || recipeData.video;
    const mediaType = recipeData.mediaType || 
                     (recipeData.video ? 'video' : 
                      recipeData.image || recipeData.media ? 'image' : 'none');

    console.log('📊 Media info:', {
      hasMedia: !!hasMedia,
      mediaType: mediaType,
      hasVideo: !!(recipeData.video || (recipeData.media && mediaType === 'video')),
      hasImage: !!(recipeData.image || (recipeData.media && mediaType === 'image')),
      mediaUri: hasMedia ? 'present' : 'none'
    });

    if (hasMedia) {
      console.log(`📸 ${mediaType} detected, using FormData...`);
      
      const formData = new FormData();
      
      // הוסף את כל הנתונים הבסיסיים
      formData.append('title', recipeData.title || '');
      formData.append('description', recipeData.description || '');
      formData.append('ingredients', recipeData.ingredients || '');
      formData.append('instructions', recipeData.instructions || '');
      formData.append('category', recipeData.category || 'Asian'); // 🔧 ברירת מחדל תקינה
      formData.append('meatType', recipeData.meatType || 'Mixed'); // 🔧 ברירת מחדל תקינה
      formData.append('prepTime', Math.max(0, recipeData.prepTime || 0).toString()); // 🔧 וידוא ערך חיובי
      formData.append('servings', Math.max(1, recipeData.servings || 1).toString()); // 🔧 וידוא ערך חיובי
      formData.append('userId', recipeData.userId || '');
      formData.append('userName', recipeData.userName || 'Anonymous Chef');
      formData.append('userAvatar', recipeData.userAvatar || '');
      formData.append('mediaType', mediaType);

      // 🆕 הוסף את המדיה בהתאם לסוג
      const mediaUri = recipeData.media || recipeData.video || recipeData.image;
      
      if (mediaType === 'video') {
        formData.append('video', {
          uri: mediaUri,
          type: 'video/mp4',
          name: 'recipe.mp4',
        });
        console.log('🎥 Video file added to FormData');
      } else if (mediaType === 'image') {
        // תמונה
        formData.append('image', {
          uri: mediaUri,
          type: 'image/jpeg',
          name: 'recipe.jpg',
        });
        console.log('📷 Image file added to FormData');
      }

      // 🆕 timeout מותאם לסוג המדיה
      const uploadTimeout = mediaType === 'video' ? 300000 : 120000; // 5 דקות לוידאו, 2 דקות לתמונה

      const response = await api.post('/recipes', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: uploadTimeout,
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          console.log(`📊 Upload progress: ${progress}%`);
        }
      });

      console.log(`✅ Recipe with ${mediaType} uploaded successfully!`);
      return { success: true, data: response.data };

    } else {
      console.log('📄 No media, using JSON...');
      
      const jsonData = {
        title: recipeData.title,
        description: recipeData.description,
        ingredients: recipeData.ingredients,
        instructions: recipeData.instructions,
        category: recipeData.category || 'Asian', // 🔧 ברירת מחדל תקינה
        meatType: recipeData.meatType || 'Mixed', // 🔧 ברירת מחדל תקינה
        prepTime: Math.max(0, recipeData.prepTime || 0), // 🔧 וידוא ערך חיובי
        servings: Math.max(1, recipeData.servings || 1), // 🔧 וידוא ערך חיובי
        userId: recipeData.userId || '',
        userName: recipeData.userName || 'Anonymous Chef',
        userAvatar: recipeData.userAvatar || null,
        mediaType: 'none' // 🆕 הוסף mediaType גם לפוסטים ללא מדיה
      };

      console.log('📤 Sending JSON data:', {
        ...jsonData,
        userId: jsonData.userId,
        userName: jsonData.userName,
        category: jsonData.category,
        meatType: jsonData.meatType
      });

      const response = await api.post('/recipes', jsonData, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('✅ Recipe without media uploaded successfully!');
      return { success: true, data: response.data };
    }

  } catch (error) {
    let errorMessage = 'Failed to create recipe';
    
    console.error('❌ Recipe creation error details:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      code: error.code
    });
    
    if (error.response) {
      errorMessage = error.response.data?.message || `Server error: ${error.response.status}`;
      
      // 🔧 הודעות שגיאה ספציפיות
      if (error.response.status === 400) {
        const validationDetails = error.response.data?.errors || [];
        if (validationDetails.length > 0) {
          errorMessage = `Validation error: ${validationDetails.join(', ')}`;
        }
      } else if (error.response.status === 413) {
        errorMessage = 'File too large. Please use a smaller image or video.';
      }
    } else if (error.request) {
      errorMessage = 'No response from server. Check your connection.';
    } else if (error.code === 'ECONNABORTED') {
      errorMessage = 'Upload took too long. Please try again with a smaller file.';
    } else {
      errorMessage = error.message || 'Unknown error occurred';
    }
    
    console.error('❌ Recipe creation error:', errorMessage);
    
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
      console.log('🔄 Fetching personalized feed...');
      const result = await recipeService.getFeed(userId);
      return result;
    } else {
      console.log('📚 Fetching all recipes from server...');
      const response = await api.get('/recipes');
      console.log(`📊 Server response: ${response.data?.length || 0} recipes`);
      
      return { success: true, data: response.data };
    }
  } catch (error) {
    console.error('❌ Get recipes error:', error.message);
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

  updateRecipe: async (recipeId, updateData, mediaUri = null) => {
  try {
    console.log('🔄 Updating recipe...', recipeId);
    console.log('🔧 Update data:', {
      title: updateData.title,
      category: updateData.category,
      meatType: updateData.meatType,
      mediaType: updateData.mediaType,
      hasMediaUri: !!mediaUri
    });
    
    const formData = new FormData();
    
    formData.append('title', updateData.title || '');
    formData.append('description', updateData.description || '');
    formData.append('ingredients', updateData.ingredients || '');
    formData.append('instructions', updateData.instructions || '');
    formData.append('category', updateData.category || 'Asian'); // 🔧 ברירת מחדל
    formData.append('meatType', updateData.meatType || 'Mixed'); // 🔧 ברירת מחדל
    formData.append('prepTime', Math.max(0, updateData.prepTime || 0).toString()); // 🔧 וידוא ערך חיובי
    formData.append('servings', Math.max(1, updateData.servings || 1).toString()); // 🔧 וידוא ערך חיובי
    formData.append('userId', updateData.userId || '');
    formData.append('mediaType', updateData.mediaType || 'none');

    if (mediaUri) {
      const mediaType = updateData.mediaType || 'image';
      console.log(`🆕 Adding new ${mediaType} to update`);
      
      if (mediaType === 'video') {
        formData.append('video', {
          uri: mediaUri,
          type: 'video/mp4',
          name: 'recipe-video.mp4',
        });
      } else {
        formData.append('image', {
          uri: mediaUri,
          type: 'image/jpeg',
          name: 'recipe-image.jpg',
        });
      }
    } else {
      // שמירת מדיה קיימת
      if (updateData.image) {
        console.log('📸 Keeping existing image');
        formData.append('image', updateData.image);
      }
      if (updateData.video) {
        console.log('🎥 Keeping existing video');
        formData.append('video', updateData.video);
      }
    }

    const timeout = updateData.mediaType === 'video' ? 300000 : 120000;

    const response = await api.put(`/recipes/${recipeId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: timeout,
      onUploadProgress: (progressEvent) => {
        const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        console.log(`🔄 Update progress: ${progress}%`);
      }
    });

    console.log('✅ Recipe updated successfully');
    return {
      success: true,
      data: response.data
    };

  } catch (error) {
    console.error('❌ Update recipe error:', error);
    
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
    console.log(' Deleting recipe from server:', recipeId);
    console.log(' Post data:', postData);
    
    if (postData && postData.groupId) {
      console.log(' Deleting group post via groupService...');
      
      const result = await groupService.deleteGroupPost(
        postData.groupId, 
        recipeId, 
        postData.userId || postData.authorId
      );
      
      if (result.success) {
        console.log(' Group post deleted successfully');
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
        console.log(' Detected group post, using group endpoint...');
        
        try {
          await api.delete(`/groups/${groupId}/posts/${recipeId}`);
          console.log(' Group post deleted via direct API call');
          return { success: true };
        } catch (groupError) {
          console.warn(' Group endpoint failed, trying regular endpoint...', groupError.message);
        }
      }
    }
    
    console.log(' Deleting regular post...');
    await api.delete(`/recipes/${recipeId}`);
    console.log(' Regular post deleted successfully');
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
      console.log(' Auto-detecting post type for deletion:', postId);
      
      const isGroupPost = postData && (
        postData.groupId || 
        postData.group || 
        postData.isGroupPost ||
        postData.type === 'group' ||
        postData.postType === 'group'
      );
      
      if (isGroupPost) {
        console.log(' Identified as group post');
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
        console.log(' Identified as regular post');
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
      console.log(' Liking recipe on server:', recipeId, 'by user:', userId);
      const response = await api.post(`/recipes/${recipeId}/like`, {
        userId: userId 
      });
      console.log(' Like response:', response.data);
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
      console.log(' Unliking recipe on server:', recipeId, 'by user:', userId);
      const response = await api.delete(`/recipes/${recipeId}/like`, {
        data: { userId: userId } 
      });
      console.log(' Unlike response:', response.data);
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
      console.log(' Adding comment to server:', recipeId);
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
      console.log(' Deleting comment from server:', commentId);
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