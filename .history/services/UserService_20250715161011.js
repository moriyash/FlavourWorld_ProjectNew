
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

class UserService {
  constructor() {
    this.baseURL = 'http://172.20.10.2:3000'; 
  }

  async searchUsers(query, currentUserId = 'temp-user-id') {
    try {
      console.log('🔍 UserService: Searching users for:', query);
      
      const response = await axios.get(`${this.baseURL}/api/users/search`, {
        params: { q: query },
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUserId,
        },
        timeout: 10000, 
      });

      console.log('✅ UserService: Search successful, found:', response.data.length, 'users');
      return response.data;
      
    } catch (error) {
      return [];
    }
  }

  async deleteUserAccount(userId, password) {
    try {
      console.log('🗑️ UserService: Deleting user account for ID:', userId);
      
      const deleteData = {
        userId: userId,
        password: password, 
        confirmDelete: true
      };

      const endpoints = [
        { url: '/api/auth/delete-account', method: 'delete' },
        { url: '/api/user/delete', method: 'delete' },
        { url: '/api/auth/delete-user', method: 'delete' }
      ];

      for (const endpoint of endpoints) {
        try {
          console.log(`🔄 Trying delete endpoint: ${endpoint.url}`);
          
          const response = await axios({
            method: endpoint.method,
            url: `${this.baseURL}${endpoint.url}`,
            data: deleteData,
            headers: {
              'Content-Type': 'application/json',
              'x-user-id': userId,
            },
            timeout: 15000, 
          });

          if (response.data.success || response.status === 200) {
            console.log('✅ User account deleted successfully via:', endpoint.url);
            return {
              success: true,
              message: 'Account deleted successfully',
              data: response.data
            };
          }
        } catch (error) {
          if (error.response && (error.response.status === 401 || error.response.status === 403)) {
            throw new Error(error.response.data.message || 'Authentication failed. Please check your password.');
          }
          
          console.log(`❌ Delete endpoint ${endpoint.url} error:`, error.message);
          continue;
        }
      }

      throw new Error('Account deletion endpoint not available. Please contact support.');
      
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to delete account'
      };
    }
  }
  async changePassword(passwordData) {
    try {
      if (!passwordData.currentPassword || !passwordData.newPassword) {
        return {
          success: false,
          message: 'Current password and new password are required'
        };
      }
      
      const endpoints = [
        { url: '/api/auth/change-password', method: 'put' },
        { url: '/api/auth/change-password', method: 'patch' },
        { url: '/api/user/change-password', method: 'put' }
      ];

      for (const endpoint of endpoints) {
        try {
          const response = await axios({
            method: endpoint.method,
            url: `${this.baseURL}${endpoint.url}`,
            data: passwordData,
            headers: {
              'Content-Type': 'application/json',
            },
            timeout: 10000,
          });

          return {
            success: true,
            message: 'Password changed successfully',
            data: response.data
          };
          
        } catch (error) {
          if (error.response) {
            const status = error.response.status;
            const errorMessage = error.response.data?.message || '';
            
            if (status === 400) {
              if (errorMessage.includes('Invalid password') || 
                  errorMessage.includes('Wrong password') ||
                  errorMessage.includes('current password') ||
                  errorMessage.includes('incorrect')) {
                return {
                  success: false,
                  message: 'Current password is incorrect'
                };
              }
              
              if (errorMessage.includes('weak') || 
                  errorMessage.includes('strong') ||
                  errorMessage.includes('password requirements')) {
                return {
                  success: false,
                  message: 'New password is too weak. Use letters, numbers and symbols'
                };
              }

              if (errorMessage.includes('same') || 
                  errorMessage.includes('identical')) {
                return {
                  success: false,
                  message: 'New password must be different from current password'
                };
              }
              
              return {
                success: false,
                message: errorMessage || 'Invalid password data provided'
              };
            }

            if (status === 401) {
              return {
                success: false,
                message: 'Current password is incorrect'
              };
            }

            if (status === 403) {
              return {
                success: false,
                message: 'You are not authorized to change this password'
              };
            }

            if (status === 404) {
              return {
                success: false,
                message: 'User account not found'
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
              message: errorMessage || 'Password change failed. Please try again.'
            };
          }

          if (error.code === 'ECONNABORTED' || error.request) {
            continue;
          }

          continue;
        }
      }

      return {
        success: false,
        message: 'Password change service is currently unavailable. Please contact support.'
      };
      
    } catch (error) {      
      return {
        success: false,
        message: 'An unexpected error occurred. Please try again later.'
      };
    }
  }

  async updateAvatar(imageUri) {
    try {
      console.log('🔄 Uploading avatar...');
      
      if (!imageUri) {
        return {
          success: false,
          message: 'No image selected'
        };
      }
      
      const formData = new FormData();
      formData.append('avatar', {
        uri: imageUri,
        type: 'image/jpeg',
        name: 'avatar.jpg',
      });

      const endpoints = [
        '/api/upload/avatar',
        '/api/user/upload-avatar', 
        '/api/auth/avatar'
      ];

      for (const endpoint of endpoints) {
        try {
          console.log(`🔄 Trying endpoint: ${endpoint}`);
          
          const response = await axios.post(`${this.baseURL}${endpoint}`, formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
            timeout: 30000,
          });

          if (response.data.success) {
            console.log('✅ Avatar uploaded successfully via:', endpoint);
            return {
              success: true,
              message: 'Profile picture updated successfully',
              data: response.data
            };
          }
        } catch (error) {
          console.log(`❌ Endpoint ${endpoint} error:`, error.message);
          continue;
        }
      }

      return {
        success: false,
        message: 'Image upload is not supported yet. Profile will be updated without image.'
      };
      
    } catch (error) {
      return {
        success: false,
        message: 'An error occurred while uploading the image'
      };
    }
  }

  async updateProfile(profileData) {
    try {
      console.log('🔄 Updating profile...');
      
      if (!profileData || Object.keys(profileData).length === 0) {
        return {
          success: false,
          message: 'No data to update'
        };
      }
      
      const endpoints = [
        { url: '/api/auth/update-profile', method: 'put' },
        { url: '/api/auth/profile', method: 'patch' },
        { url: '/api/user/profile', method: 'put' }
      ];

      for (const endpoint of endpoints) {
        try {
          console.log(`🔄 Trying endpoint: ${endpoint.url}`);
          
          const response = await axios({
            method: endpoint.method,
            url: `${this.baseURL}${endpoint.url}`,
            data: profileData,
            headers: {
              'Content-Type': 'application/json',
            },
            timeout: 10000,
          });

          console.log('✅ Profile updated successfully via:', endpoint.url);
          return {
            success: true,
            message: 'Profile updated successfully',
            data: response.data
          };
        } catch (error) {
          console.log(`❌ Endpoint ${endpoint.url} error:`, error.message);
          
          if (error.response?.status === 400) {
            return {
              success: false,
              message: error.response.data?.message || 'Invalid data provided'
            };
          }
          
          continue;
        }
      }

      return {
        success: false,
        message: 'Profile update service is currently unavailable. Please contact support.'
      };
      
    } catch (error) {
      return {
        success: false,
        message: 'An error occurred while updating profile'
      };
    }
  }

  async getUserProfile(userId) {
    try {
      if (!userId) {
        return {
          success: false,
          message: 'User ID is required'
        };
      }
      
      const response = await axios.get(`${this.baseURL}/api/user/profile/${userId}`, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      return {
        success: true,
        data: response.data.user
      };
    } catch (error) {
      
      if (error.response?.status === 404) {
        return {
          success: false,
          message: 'User not found'
        };
      }
      
      return {
        success: false,
        message: error.response?.data?.message || 'An error occurred while loading profile'
      };
    }
  }
}

export const userService = new UserService();