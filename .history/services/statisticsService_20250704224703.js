import axios from 'axios';

const API_BASE_URL = 'http://192.168.1.222:3000';

class StatisticsService {
  constructor() {
    this.baseURL = `${API_BASE_URL}/api/statistics`;
    
    this.api = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status >= 500) {
          console.error('Server error occurred');
        }
        return Promise.reject(error);
      }
    );
  }

  setAuthToken(token) {
    if (token) {
      this.api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete this.api.defaults.headers.common['Authorization'];
    }
  }

  async getUserStatistics(userId) {
    try {
      console.log('Fetching user statistics');
      
      const response = await this.api.get(`/user/${userId}`);

      if (response.data && response.data.success) {
        console.log('Statistics fetched successfully');
        return {
          success: true,
          data: response.data.data
        };
      } else {
        console.log('No statistics data available');
        return {
          success: false,
          message: response.data?.message || 'Failed to fetch statistics'
        };
      }
    } catch (error) {
      console.error('Statistics fetch failed');
      
      if (error.response) {
        return {
          success: false,
          message: error.response.data?.message || `Server error: ${error.response.status}`,
          status: error.response.status
        };
      } else if (error.request) {
        return {
          success: false,
          message: 'Network error - server not responding'
        };
      } else {
        return {
          success: false,
          message: error.message || 'Request configuration error'
        };
      }
    }
  }

  async getLikesProgression(userId) {
    try {
      console.log('Fetching likes progression');
      
      const response = await this.api.get(`/likes-progression/${userId}`);
      
      if (response.data && response.data.success) {
        console.log('Likes progression fetched successfully');
        return {
          success: true,
          data: response.data.data
        };
      } else {
        console.log('No likes progression data available');
        return {
          success: false,
          message: response.data?.message || 'Failed to fetch likes progression'
        };
      }
    } catch (error) {
      console.error('Likes progression fetch failed');
      return {
        success: false,
        message: error.response?.data?.message || 'Network error occurred'
      };
    }
  }

  async getFollowersGrowth(userId) {
    try {
      console.log('Fetching followers data');
      
      const response = await this.api.get(`/users/${userId}/follow-status/${userId}`, {
        baseURL: `${API_BASE_URL}/api`
      });
      
      if (response.data && response.data.followersCount !== undefined) {
        console.log('Followers data retrieved successfully');
        
        const currentFollowers = response.data.followersCount;
        
        const followersGrowth = [{
          month: new Date().toLocaleString('default', { month: 'short' }),
          monthYear: new Date().toLocaleString('default', { month: 'short', year: 'numeric' }),
          date: new Date(),
          followers: currentFollowers
        }];
        
        return {
          success: true,
          data: followersGrowth,
          currentFollowersCount: currentFollowers
        };
      } else {
        console.log('No followers data available');
        return {
          success: false,
          message: 'No followers data available'
        };
      }
    } catch (error) {
      console.error('Followers data fetch failed');
      return {
        success: false,
        message: error.response?.data?.message || 'Network error occurred'
      };
    }
  }

  async getCategoriesDistribution(userId) {
    try {
      console.log('Fetching categories distribution');
      
      const response = await this.api.get(`/categories-distribution/${userId}`);
      
      if (response.data && response.data.success) {
        console.log('Categories distribution fetched successfully');
        return {
          success: true,
          data: response.data.data
        };
      } else {
        console.log('No categories distribution data available');
        return {
          success: false,
          message: response.data?.message || 'Failed to fetch categories distribution'
        };
      }
    } catch (error) {
      console.error('Categories distribution fetch failed');
      return {
        success: false,
        message: error.response?.data?.message || 'Network error occurred'
      };
    }
  }

  processRealUserData(userPosts, userId) {
    console.log('Processing user data');
    
    if (!userPosts || userPosts.length === 0) {
      console.log('No posts found for user');
      return {
        totalPosts: 0,
        totalLikes: 0,
        totalFollowers: 0,
        averageLikes: 0,
        likesProgression: [],
        categoriesDistribution: [],
        followersGrowth: []
      };
    }

    console.log('User data processed successfully');

    const totalPosts = userPosts.length;
    const totalLikes = userPosts.reduce((sum, post) => sum + (post.likes?.length || 0), 0);
    
    const likesProgression = userPosts
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .map((post, index) => ({
        postIndex: index + 1,
        likes: post.likes?.length || 0,
        postTitle: post.title || post.recipeName || `Recipe ${index + 1}`,
        date: new Date(post.createdAt),
        postId: post._id || post.id,
        createdAt: post.createdAt
      }));

    const categoriesMap = {};
    userPosts.forEach(post => {
      const category = post.category || post.cuisine || 'Other';
      categoriesMap[category] = (categoriesMap[category] || 0) + 1;
    });

    const categoriesDistribution = Object.entries(categoriesMap).map(([category, count]) => ({
      category,
      count,
      percentage: totalPosts > 0 ? Math.round((count / totalPosts) * 100) : 0
    }));

    const followersGrowth = [];

    const processedData = {
      totalPosts,
      totalLikes,
      totalFollowers: 0,
      averageLikes: totalPosts > 0 ? Math.round(totalLikes / totalPosts) : 0,
      likesProgression,
      categoriesDistribution,
      followersGrowth
    };

    return processedData;
  }

  async testConnection() {
    try {
      console.log('Testing server connection');
      const response = await this.api.get('/health');
      console.log('Server connection successful');
      return {
        success: true,
        message: 'Server connection successful',
        data: response.data
      };
    } catch (error) {
      console.error('Server connection failed');
      return {
        success: false,
        message: 'Server connection failed',
        error: error.message
      };
    }
  }

  async updateUserStatistics(userId, statsData) {
    try {
      console.log('Updating user statistics');
      
      const response = await this.api.put(`/user/${userId}`, statsData);
      
      if (response.data && response.data.success) {
        console.log('Statistics updated successfully');
        return {
          success: true,
          data: response.data.data,
          message: 'Statistics updated successfully'
        };
      } else {
        console.log('Statistics update failed');
        return {
          success: false,
          message: response.data?.message || 'Failed to update statistics'
        };
      }
    } catch (error) {
      console.error('Statistics update error occurred');
      return {
        success: false,
        message: error.response?.data?.message || 'Network error occurred'
      };
    }
  }
}

const statisticsServiceInstance = new StatisticsService();

export const statisticsService = statisticsServiceInstance;

export default statisticsServiceInstance;