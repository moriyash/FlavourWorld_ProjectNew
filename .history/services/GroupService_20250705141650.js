import axios from 'axios';

class GroupService {
  constructor() {
    this.baseURL = 'http://192.168.0.101:3000/api';
    
    this.axiosInstance = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  // Create new group
  async createGroup(groupData, imageUri = null) {
    try {
      console.log('Creating group');
      
      const formData = new FormData();
      
      formData.append('name', groupData.name);
      formData.append('description', groupData.description || '');
      formData.append('category', groupData.category || 'General');
      formData.append('rules', groupData.rules || '');
      formData.append('creatorId', groupData.creatorId);
      formData.append('isPrivate', groupData.isPrivate.toString());
      formData.append('allowMemberPosts', groupData.allowMemberPosts.toString());
      formData.append('requireApproval', groupData.requireApproval.toString());
      formData.append('allowInvites', groupData.allowInvites.toString());

      if (imageUri) {
        formData.append('image', {
          uri: imageUri,
          type: 'image/jpeg',
          name: 'group-image.jpg',
        });
      }

      const response = await this.axiosInstance.post('/groups', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000,
      });

      console.log('Group created successfully');
      return {
        success: true,
        data: response.data
      };
      
    } catch (error) {
      console.error('Create group error occurred');
      
      if (error.code === 'ECONNABORTED') {
        return {
          success: false,
          message: 'Request timeout - please check your connection and try again'
        };
      }
      
      return {
        success: false,
        message: error.response?.data?.message || error.message
      };
    }
  }

  // Get all groups
  async getAllGroups(userId = null, includePrivateForSearch = false) {
    try {
      console.log('Fetching groups');
      
      const params = {};
      if (userId) params.userId = userId;
      if (includePrivateForSearch) params.includePrivate = 'true';
      
      const response = await this.axiosInstance.get('/groups', { 
        params,
        timeout: 15000
      });

      console.log('Groups fetched successfully');
      return {
        success: true,
        data: response.data
      };
      
    } catch (error) {
      console.error('Fetch groups error occurred');
      
      if (error.code === 'ECONNABORTED') {
        return {
          success: false,
          message: 'Connection timeout - please check your network and try again'
        };
      }
      
      return {
        success: false,
        message: error.response?.data?.message || error.message
      };
    }
  }

  // Search groups
  async searchGroups(query, userId = null) {
    try {
      console.log('Searching groups');
      
      const params = { 
        q: query,
        includePrivate: 'true'
      };
      if (userId) params.userId = userId;
      
      try {
        const response = await this.axiosInstance.get('/groups/search', { 
          params,
          timeout: 15000
        });

        console.log('Groups search completed');
        return {
          success: true,
          data: response.data
        };
      } catch (searchError) {
        console.log('Search endpoint failed, using fallback');
        
        const allGroupsParams = { includePrivate: 'true' };
        if (userId) allGroupsParams.userId = userId;
        
        const response = await this.axiosInstance.get('/groups', { 
          params: allGroupsParams,
          timeout: 15000
        });

        const filtered = response.data.filter(group => {
          const searchTerm = query.toLowerCase();
          return (
            group.name?.toLowerCase().includes(searchTerm) ||
            group.description?.toLowerCase().includes(searchTerm) ||
            group.category?.toLowerCase().includes(searchTerm) ||
            group.creatorName?.toLowerCase().includes(searchTerm)
          );
        });

        console.log('Fallback search completed');
        return {
          success: true,
          data: filtered
        };
      }
      
    } catch (error) {
      console.error('Search groups error occurred');
      return {
        success: false,
        message: error.response?.data?.message || error.message
      };
    }
  }

  // Get single group with details
  async getGroup(groupId) {
    try {
      console.log('Fetching group details');
      
      const response = await this.axiosInstance.get(`/groups/${groupId}`);

      console.log('Group details fetched successfully');
      return {
        success: true,
        data: response.data
      };
      
    } catch (error) {
      console.error('Fetch group details error occurred');
      return {
        success: false,
        message: error.response?.data?.message || error.message
      };
    }
  }

  // Join group
  async joinGroup(groupId, userId) {
    try {
      console.log('Joining group');
      
      const response = await this.axiosInstance.post(`/groups/${groupId}/join`, {
        userId
      });

      console.log('Join request sent successfully');
      return {
        success: true,
        data: response.data
      };
      
    } catch (error) {
      console.error('Join group error occurred');
      return {
        success: false,
        message: error.response?.data?.message || error.message
      };
    }
  }

  // Cancel join request
  async cancelJoinRequest(groupId, userId) {
    try {
      console.log('Canceling join request');
      
      const response = await this.axiosInstance.delete(`/groups/${groupId}/join`, {
        data: { userId }
      });

      console.log('Join request canceled successfully');
      return {
        success: true,
        data: response.data
      };
      
    } catch (error) {
      console.error('Cancel join request error occurred');
      return {
        success: false,
        message: error.response?.data?.message || error.message
      };
    }
  }

  // Handle join request
  async handleJoinRequest(groupId, userId, action, adminId) {
    try {
      console.log(`${action}ing join request`);
      
      const response = await this.axiosInstance.put(`/groups/${groupId}/requests/${userId}`, {
        action,
        adminId
      });

      console.log(`Join request ${action}ed successfully`);
      return {
        success: true,
        data: response.data
      };
      
    } catch (error) {
      console.error(`${action} join request error occurred`);
      return {
        success: false,
        message: error.response?.data?.message || error.message
      };
    }
  }

  // Leave group
  async leaveGroup(groupId, userId) {
    try {
      console.log('Leaving group');
      
      const response = await this.axiosInstance.delete(`/groups/${groupId}/leave/${userId}`);

      console.log('Left group successfully');
      return {
        success: true,
        data: response.data
      };
      
    } catch (error) {
      console.error('Leave group error occurred');
      return {
        success: false,
        message: error.response?.data?.message || error.message
      };
    }
  }

  // 🆕 Remove member from group (admin only)
  async removeMember(groupId, memberUserId, adminUserId) {
    try {
      console.log('Removing member from group');
      
      const response = await this.axiosInstance.delete(`/groups/${groupId}/members/${memberUserId}`, {
        data: { adminId: adminUserId }
      });

      console.log('Member removed successfully');
      return {
        success: true,
        data: response.data
      };
      
    } catch (error) {
      console.error('Remove member error occurred');
      return {
        success: false,
        message: error.response?.data?.message || error.message
      };
    }
  }

  // Delete group
  async deleteGroup(groupId, userId) {
    try {
      console.log('Deleting group');
      
      const response = await this.axiosInstance.delete(`/groups/${groupId}`, {
        data: { userId }
      });

      console.log('Group deleted successfully');
      return {
        success: true,
        data: response.data
      };
      
    } catch (error) {
      console.error('Delete group error occurred');
      return {
        success: false,
        message: error.response?.data?.message || error.message
      };
    }
  }

  // Update group post
  async updateGroupPost(groupId, postId, updateData, imageUri = null) {
    try {
        console.log('Updating group post');
        
        const formData = new FormData();
        
        formData.append('title', updateData.title);
        formData.append('description', updateData.description || '');
        formData.append('ingredients', updateData.ingredients || '');
        formData.append('instructions', updateData.instructions || '');
        formData.append('category', updateData.category || 'General');
        formData.append('meatType', updateData.meatType || 'Mixed');
        formData.append('prepTime', updateData.prepTime?.toString() || '0');
        formData.append('servings', updateData.servings?.toString() || '1');
        formData.append('userId', updateData.userId);

        if (imageUri) {
        formData.append('image', {
            uri: imageUri,
            type: 'image/jpeg',
            name: 'recipe-image.jpg',
        });
        } else if (updateData.image) {
        formData.append('image', updateData.image);
        }

        const response = await this.axiosInstance.put(`/groups/${groupId}/posts/${postId}`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
        timeout: 30000,
        });

        console.log('Group post updated successfully');
        return {
        success: true,
        data: response.data
        };
        
    } catch (error) {
        console.error('Update group post error occurred');
        
        if (error.code === 'ECONNABORTED') {
        return {
            success: false,
            message: 'Request timeout - please check your connection and try again'
        };
        }
        
        return {
        success: false,
        message: error.response?.data?.message || error.message
        };
    }
  }

  // Check if user is member of group
  isMember(group, userId) {
    if (!group || !group.members || !userId) {
      console.log('isMember: Missing data');
      return false;
    }
    
    const isMember = group.members.some(member => {
      const memberId = member.userId || member._id || member.id;
      return memberId === userId || memberId?.toString() === userId?.toString();
    });
    
    console.log('isMember check result:', isMember);
    return isMember;
  }

  // Check if user is admin of group
  isAdmin(group, userId) {
    if (!group || !group.members || !userId) {
      console.log('isAdmin: Missing data');
      return false;
    }
    
    const isAdmin = group.members.some(member => {
      const memberId = member.userId || member._id || member.id;
      const isAdminRole = member.role === 'admin' || member.role === 'owner';
      return (memberId === userId || memberId?.toString() === userId?.toString()) && isAdminRole;
    });
    
    console.log('isAdmin check result:', isAdmin);
    return isAdmin;
  }

  // Check if user is creator of group
  isCreator(group, userId) {
    if (!group || !userId) {
      console.log('isCreator: Missing data');
      return false;
    }
    
    const creatorId = group.creatorId || group.creator || group.ownerId;
    const isCreator = creatorId === userId || creatorId?.toString() === userId?.toString();
    
    console.log('isCreator check result:', isCreator);
    return isCreator;
  }

  // Check if user has pending join request
  hasPendingRequest(group, userId) {
    if (!group || !group.pendingRequests || !userId) return false;
    return group.pendingRequests.some(request => {
      const requestUserId = request.userId || request._id || request.id;
      return requestUserId === userId || requestUserId?.toString() === userId?.toString();
    });
  }

  // 🔧 Update group settings - תיקון מלא עם תמיכה בתמונות
  async updateGroup(groupId, updateData, imageUri = null) {
    try {
      console.log('🏭 === GroupService.updateGroup STARTED ===');
      console.log('📥 Input parameters:');
      console.log('   - Group ID:', groupId);
      console.log('   - Update data keys:', Object.keys(updateData));
      console.log('   - Update data:', JSON.stringify(updateData, null, 2));
      console.log('   - Image URI:', imageUri);
      console.log('   - Image URI type:', typeof imageUri);
      console.log('   - Is file URI?', imageUri?.startsWith('file://'));

      const formData = new FormData();

      // Add basic fields - רק אם הם קיימים
      if (updateData.name !== undefined) {
        formData.append('name', updateData.name);
        console.log('📝 Added name to FormData:', updateData.name);
      }
      if (updateData.description !== undefined) {
        formData.append('description', updateData.description || '');
        console.log('📄 Added description to FormData');
      }
      if (updateData.category !== undefined) {
        formData.append('category', updateData.category || 'General');
        console.log('📂 Added category to FormData:', updateData.category);
      }
      if (updateData.rules !== undefined) {
        formData.append('rules', updateData.rules || '');
        console.log('📋 Added rules to FormData');
      }
      if (updateData.isPrivate !== undefined) {
        formData.append('isPrivate', updateData.isPrivate.toString());
        console.log('🔒 Added isPrivate to FormData:', updateData.isPrivate);
      }
      if (updateData.allowMemberPosts !== undefined) {
        formData.append('allowMemberPosts', updateData.allowMemberPosts.toString());
        console.log('👥 Added allowMemberPosts to FormData:', updateData.allowMemberPosts);
      }
      if (updateData.requireApproval !== undefined) {
        formData.append('requireApproval', updateData.requireApproval.toString());
        console.log('✋ Added requireApproval to FormData:', updateData.requireApproval);
      }
      if (updateData.allowInvites !== undefined) {
        formData.append('allowInvites', updateData.allowInvites.toString());
        console.log('📨 Added allowInvites to FormData:', updateData.allowInvites);
      }
      if (updateData.updatedBy !== undefined) {
        formData.append('updatedBy', updateData.updatedBy);
        console.log('👤 Added updatedBy to FormData:', updateData.updatedBy);
      }

      // Handle image upload/removal
      if (updateData.removeImage) {
        console.log('🗑️ === IMAGE REMOVAL PROCESS ===');
        formData.append('removeImage', 'true');
        console.log('✅ Added removeImage flag to FormData');
      } else if (imageUri && imageUri.startsWith('file://')) {
        console.log('📸 === IMAGE UPLOAD PROCESS ===');
        console.log('   - Original URI:', imageUri);
        
        // קבל את סוג הקובץ מה-URI
        const fileExtension = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
        let mimeType = 'image/jpeg'; // default
        
        switch (fileExtension) {
          case 'png':
            mimeType = 'image/png';
            break;
          case 'gif':
            mimeType = 'image/gif';
            break;
          case 'webp':
            mimeType = 'image/webp';
            break;
          default:
            mimeType = 'image/jpeg';
        }
        
        const fileName = `group_cover_${Date.now()}.${fileExtension}`;
        
        console.log('   - File extension detected:', fileExtension);
        console.log('   - MIME type:', mimeType);
        console.log('   - Generated filename:', fileName);
        
        const imageObject = {
          uri: imageUri,
          type: mimeType,
          name: fileName,
        };
        
        console.log('   - Image object for FormData:', imageObject);
        
        formData.append('image', imageObject);
        console.log('✅ Image added to FormData successfully');
      } else if (imageUri) {
        console.log('🔗 Image URI provided but not a file:// URI:', imageUri);
        console.log('   - Skipping image upload (probably existing online image)');
      }

      console.log('📡 === SENDING REQUEST TO SERVER ===');
      console.log('   - URL:', `${this.baseURL}/groups/${groupId}`);
      console.log('   - Method: PUT');
      console.log('   - Content-Type: multipart/form-data');
      console.log('   - Timeout: 30000ms');
      
      const response = await this.axiosInstance.put(`/groups/${groupId}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000,
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            console.log(`📊 Upload progress: ${percentCompleted}% (${progressEvent.loaded}/${progressEvent.total} bytes)`);
          } else {
            console.log(`📊 Upload progress: ${progressEvent.loaded} bytes uploaded`);
          }
        },
      });

      console.log('🎉 === SERVER RESPONSE RECEIVED ===');
      console.log('   - Status:', response.status);
      console.log('   - Status text:', response.statusText);
      console.log('   - Response data:', JSON.stringify(response.data, null, 2));
      
      // בדוק אם השרת החזיר תמונה חדשה
      if (response.data?.image) {
        console.log('🖼️ Server returned updated image URL:', response.data.image);
      } else {
        console.log('⚪ No image URL in server response');
      }

      console.log('✅ === GroupService.updateGroup COMPLETED SUCCESSFULLY ===');
      return {
        success: true,
        data: response.data
      };
      
    } catch (error) {
      console.error('❌ === GroupService.updateGroup FAILED ===');
      console.error('   - Error type:', error.constructor.name);
      console.error('   - Error message:', error.message);
      console.error('   - Response status:', error.response?.status);
      console.error('   - Response data:', error.response?.data);
      console.error('   - Request config:', error.config ? {
        url: error.config.url,
        method: error.config.method,
        headers: error.config.headers,
        timeout: error.config.timeout
      } : 'No config available');
      
      // טיפול מפורט בשגיאות
      if (error.code === 'ECONNABORTED') {
        console.error('🕐 Request timeout occurred');
        return {
          success: false,
          message: 'Request timeout - please check your connection and try again'
        };
      }
      
      if (error.response?.status === 413) {
        console.error('📏 File too large error');
        return {
          success: false,
          message: 'Image file is too large. Please choose a smaller image (max 5MB).'
        };
      }
      
      if (error.response?.status === 400) {
        const errorMsg = error.response.data?.message;
        console.error('❌ Bad request error:', errorMsg);
        if (errorMsg?.includes('Invalid image')) {
          return {
            success: false,
            message: 'Invalid image format. Please use JPG, PNG, GIF, or WebP.'
          };
        }
        return {
          success: false,
          message: errorMsg || 'Invalid data provided'
        };
      }
      
      if (error.response?.status === 403) {
        console.error('🚫 Permission denied error');
        return {
          success: false,
          message: 'You do not have permission to update this group'
        };
      }
      
      if (error.response?.status === 404) {
        console.error('🔍 Group not found error');
        return {
          success: false,
          message: 'Group not found'
        };
      }
      
      if (error.response?.status >= 500) {
        console.error('🔥 Server error');
        return {
          success: false,
          message: 'Server error. Please try again later.'
        };
      }
      
      console.error('❓ Unknown error occurred');
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to update group'
      };
    }
  }

  // ============ GROUP POSTS ============

  // 🔧 תיקון: Get posts for a specific group - כלול גם פוסטים שמחכים לאישור למשתמש עצמו
  async getGroupPosts(groupId, userId = null) {
    try {
      console.log('Fetching group posts');
      
      const params = userId ? { userId } : {};
      const response = await this.axiosInstance.get(`/groups/${groupId}/posts`, { 
        params,
        timeout: 15000
      });

      console.log('Group posts fetched successfully');
      return {
        success: true,
        data: response.data || []
      };
      
    } catch (error) {
      console.error('Fetch group posts error occurred');
      
      if (error.code === 'ECONNABORTED') {
        return {
          success: false,
          message: 'Connection timeout - please check your network and try again'
        };
      }

      if (error.response?.status === 403) {
        console.log('Access denied to private group, returning empty array');
        return {
          success: true,
          data: [],
          message: 'This is a private group'
        };
      }

      if (error.response?.status === 404) {
        console.log('Group not found, returning empty array');
        return {
          success: true,
          data: [],
          message: 'Group not found'
        };
      }
      
      return {
        success: false,
        message: error.response?.data?.message || error.message
      };
    }
  }

  // Create post in group
  async createGroupPost(groupId, postData, imageUri = null) {
    try {
      console.log('Creating group post');
      
      const formData = new FormData();
      
      formData.append('title', postData.title);
      formData.append('description', postData.description || '');
      formData.append('ingredients', postData.ingredients || '');
      formData.append('instructions', postData.instructions || '');
      formData.append('category', postData.category || 'General');
      formData.append('meatType', postData.meatType || 'Mixed');
      formData.append('prepTime', postData.prepTime?.toString() || '0');
      formData.append('servings', postData.servings?.toString() || '1');
      formData.append('userId', postData.userId);

      if (imageUri) {
        formData.append('image', {
          uri: imageUri,
          type: 'image/jpeg',
          name: 'recipe-image.jpg',
        });
      }

      console.log('Sending request to create group post');
      const response = await this.axiosInstance.post(`/groups/${groupId}/posts`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000,
      });

      console.log('Group post created successfully');
      return {
        success: true,
        data: response.data
      };
      
    } catch (error) {
      console.error('Create group post error occurred');
      
      if (error.code === 'ECONNABORTED') {
        return {
          success: false,
          message: 'Request timeout - please check your connection and try again'
        };
      }
      
      if (error.response?.data?.message) {
        console.log('Server error message received');
        return {
          success: false,
          message: error.response.data.message
        };
      }
      
      return {
        success: false,
        message: error.message || 'Failed to create group post'
      };
    }
  }

  // Delete group post
  async deleteGroupPost(groupId, postId, userId) {
    try {
      console.log('Deleting group post');
      
      const response = await this.axiosInstance.delete(`/groups/${groupId}/posts/${postId}`, {
        data: { userId }
      });

      console.log('Group post deleted successfully');
      return {
        success: true,
        data: response.data
      };
      
    } catch (error) {
      console.error('Delete group post error occurred');
      return {
        success: false,
        message: error.response?.data?.message || error.message
      };
    }
  }

  // ============ GROUP POSTS INTERACTIONS ============

  // Like group post
  async likeGroupPost(groupId, postId, userId) {
    try {
      console.log('Liking group post');
      
      const response = await this.axiosInstance.post(`/groups/${groupId}/posts/${postId}/like`, {
        userId
      });

      console.log('Group post liked successfully');
      return {
        success: true,
        data: response.data
      };
      
    } catch (error) {
      console.error('Like group post error occurred');
      return {
        success: false,
        message: error.response?.data?.message || error.message
      };
    }
  }

  // Unlike group post
  async unlikeGroupPost(groupId, postId, userId) {
    try {
      console.log('Unliking group post');
      
      const response = await this.axiosInstance.delete(`/groups/${groupId}/posts/${postId}/like`, {
        data: { userId }
      });

      console.log('Group post unliked successfully');
      return {
        success: true,
        data: response.data
      };
      
    } catch (error) {
      console.error('Unlike group post error occurred');
      return {
        success: false,
        message: error.response?.data?.message || error.message
      };
    }
  }

  // Add comment to group post
  async addCommentToGroupPost(groupId, postId, commentData) {
    try {
      console.log('Adding comment to group post');
      
      const response = await this.axiosInstance.post(`/groups/${groupId}/posts/${postId}/comments`, commentData);

      console.log('Comment added to group post successfully');
      
      // תיקון: החזר את הנתונים בתוך data
      return {
        success: true,
        data: response.data.data || response.data // תמיכה בשני הפורמטים
      };
      
    } catch (error) {
      console.error('Add comment to group post error occurred');
      return {
        success: false,
        message: error.response?.data?.message || error.message
      };
    }
  }

  // Delete comment from group post
  async deleteCommentFromGroupPost(groupId, postId, commentId, userId) {
    try {
      console.log('Deleting comment from group post');
      
      const response = await this.axiosInstance.delete(`/groups/${groupId}/posts/${postId}/comments/${commentId}`, {
        data: { userId }
      });

      console.log('Comment deleted from group post successfully');
      return {
        success: true,
        data: response.data
      };
      
    } catch (error) {
      console.error('Delete comment from group post error occurred');
      return {
        success: false,
        message: error.response?.data?.message || error.message
      };
    }
  }

  // 🆕 Get group with full member details
  async getGroupWithMembers(groupId) {
    try {
      console.log('Fetching group with full member details');
      
      const response = await this.axiosInstance.get(`/groups/${groupId}/members`);

      console.log('Group with members fetched successfully');
      return {
        success: true,
        data: response.data
      };
      
    } catch (error) {
      console.error('Fetch group with members error occurred');
      return {
        success: false,
        message: error.response?.data?.message || error.message
      };
    }
  }

  // 🆕 Update member role (promote/demote)
  async updateMemberRole(groupId, memberUserId, newRole, adminUserId) {
    try {
      console.log('Updating member role');
      
      const response = await this.axiosInstance.put(`/groups/${groupId}/members/${memberUserId}/role`, {
        role: newRole,
        adminId: adminUserId
      });

      console.log('Member role updated successfully');
      return {
        success: true,
        data: response.data
      };
      
    } catch (error) {
      console.error('Update member role error occurred');
      return {
        success: false,
        message: error.response?.data?.message || error.message
      };
    }
  }
}

export const groupService = new GroupService();