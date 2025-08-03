import axios from 'axios';

class GroupService {
  constructor() {
    this.baseURL = 'http:// 192.168.0.104:3000/api';
    
    this.axiosInstance = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

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
      return {
        success: false,
        message: error.response?.data?.message || error.message
      };
    }
  }

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
      return {
        success: false,
        message: error.response?.data?.message || error.message
      };
    }
  }

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
      return {
        success: false,
        message: error.response?.data?.message || error.message
      };
    }
  }

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
      return {
        success: false,
        message: error.response?.data?.message || error.message
      };
    }
  }

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
      return {
        success: false,
        message: error.response?.data?.message || error.message
      };
    }
  }

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
      return {
        success: false,
        message: error.response?.data?.message || error.message
      };
    }
  }

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
      return {
        success: false,
        message: error.response?.data?.message || error.message
      };
    }
  }

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
      return {
        success: false,
        message: error.response?.data?.message || error.message
      };
    }
  }

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

  hasPendingRequest(group, userId) {
    if (!group || !group.pendingRequests || !userId) return false;
    return group.pendingRequests.some(request => {
      const requestUserId = request.userId || request._id || request.id;
      return requestUserId === userId || requestUserId?.toString() === userId?.toString();
    });
  }

  async updateGroup(groupId, updateData, imageUri = null) {
    try {
      console.log('Updating group settings');
      
      const formData = new FormData();
      
      formData.append('name', updateData.name);
      formData.append('description', updateData.description || '');
      formData.append('category', updateData.category || 'General');
      formData.append('rules', updateData.rules || '');
      formData.append('isPrivate', updateData.isPrivate.toString());
      formData.append('allowMemberPosts', updateData.allowMemberPosts.toString());
      formData.append('requireApproval', updateData.requireApproval.toString());
      formData.append('allowInvites', updateData.allowInvites.toString());
      formData.append('updatedBy', updateData.updatedBy);

      if (imageUri) {
        formData.append('image', {
          uri: imageUri,
          type: 'image/jpeg',
          name: 'group-cover.jpg',
        });
      }

      const response = await this.axiosInstance.put(`/groups/${groupId}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000,
      });

      console.log('Group updated successfully');
      return {
        success: true,
        data: response.data
      };
      
    } catch (error) {
      
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
      return {
        success: false,
        message: error.response?.data?.message || error.message
      };
    }
  }

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
      return {
        success: false,
        message: error.response?.data?.message || error.message
      };
    }
  }

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
      return {
        success: false,
        message: error.response?.data?.message || error.message
      };
    }
  }

  async addCommentToGroupPost(groupId, postId, commentData) {
    try {
      console.log('Adding comment to group post');
      
      const response = await this.axiosInstance.post(`/groups/${groupId}/posts/${postId}/comments`, commentData);

      console.log('Comment added to group post successfully');
      
      return {
        success: true,
        data: response.data.data || response.data 
      };
      
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || error.message
      };
    }
  }

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
      return {
        success: false,
        message: error.response?.data?.message || error.message
      };
    }
  }

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
      return {
        success: false,
        message: error.response?.data?.message || error.message
      };
    }
  }

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
      return {
        success: false,
        message: error.response?.data?.message || error.message
      };
    }
  }

  async getDiscoverGroups(userId, limit = 6) {
    try {
      console.log('Fetching discover groups sample');
      
      const params = {};
      if (userId) params.userId = userId;
      
      const response = await this.axiosInstance.get('/groups', { 
        params,
        timeout: 15000
      });

      console.log('Groups fetched for discover');
      
      // סנן קבוצות שהמשתמש לא חבר בהן
      const nonMemberGroups = response.data.filter(group => 
        !this.isMember(group, userId)
      );
      
      // בחר מדגם רנדומלי של קבוצות
      const shuffled = nonMemberGroups.sort(() => 0.5 - Math.random());
      const discoverGroups = shuffled.slice(0, limit);
      
      console.log(`Returning ${discoverGroups.length} discover groups`);
      
      return {
        success: true,
        data: discoverGroups
      };
      
    } catch (error) {
      
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
}

export const groupService = new GroupService();