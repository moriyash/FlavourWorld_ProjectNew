import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
  FlatList,
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../services/AuthContext';
import { recipeService } from '../../../services/recipeService';
import { userService } from '../../../services/UserService';
import { chatService } from '../../../services/chatServices';
import { statisticsService } from '../../../services/statisticsService';
import { groupService } from '../../../services/GroupService'; 
import UserAvatar from '../../common/UserAvatar';
import PostComponent from '../../common/PostComponent';

const FLAVORWORLD_COLORS = {
  primary: '#F5A623',
  secondary: '#4ECDC4',
  accent: '#1F3A93',
  background: '#FFF8F0',
  white: '#FFFFFF',
  text: '#2C3E50',
  textLight: '#7F8C8D',
  border: '#E8E8E8',
  success: '#27AE60',
  danger: '#E74C3C',
  warning: '#F39C12',
};

const { width: screenWidth } = Dimensions.get('window');

const ProfileScreen = ({ route, navigation }) => {
  const { currentUser, logout } = useAuth();
  const [profileUser, setProfileUser] = useState(null);
  const [userPosts, setUserPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState('posts'); 
  const [stats, setStats] = useState({
    postsCount: 0,
    likesCount: 0,
    followersCount: 0
  });

  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [startingChat, setStartingChat] = useState(false);
  
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const userId = route?.params?.userId || currentUser?.id || currentUser?._id;
  const isOwnProfile = userId === (currentUser?.id || currentUser?._id);

  useEffect(() => {
    loadProfileData();
  }, [userId]);

  const loadProfileData = async () => {
    setLoading(true);
    try {
      if (isOwnProfile) {
        setProfileUser(currentUser);
        console.log('Loading own profile');
      } else {
        console.log('Loading user profile');
        const userResult = await userService.getUserProfile(userId);
        
        if (userResult.success) {
          setProfileUser(userResult.data);
          console.log('User profile loaded successfully');
          
          await loadFollowStatus();
        } else {
          Alert.alert('Error', 'Failed to load user profile');
          navigation.goBack();
          return;
        }
      }

      await loadUserPosts();
      
    } catch (error) {
      Alert.alert('Error', 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const loadFollowStatus = async () => {
    if (isOwnProfile || !currentUser?.id) return;
    
    try {
      console.log('Loading follow status');
      
      const result = await chatService.getFollowStatus(
        userId, 
        currentUser.id || currentUser._id
      );
      
      if (result.success) {
        setIsFollowing(result.data.isFollowing);
        setStats(prev => ({
          ...prev,
          followersCount: result.data.followersCount
        }));
        
        console.log('Follow status loaded successfully');
      } else {
      }
    } catch (error) {
    }
  };

  const loadUserGroupPosts = async () => {
    try {
      console.log('Loading user group posts with privacy filter');
      console.log(`Loading for user: ${userId}, Viewer: ${currentUser?.id || currentUser?._id}, isOwnProfile: ${isOwnProfile}`);
      
      const groupsResult = await groupService.getAllGroups(userId);
      
      if (!groupsResult.success) {
        return { success: false, data: [] };
      }

      const userGroups = groupsResult.data.filter(group => 
        groupService.isMember(group, userId)
      );

      console.log(`User is member of ${userGroups.length} groups`);
      
      let allGroupPosts = [];
      
      for (const group of userGroups) {
        try {
          // בדיקת פרטיות - אם הקבוצה פרטית והמשתמש הצופה לא חבר בה
          if (group.isPrivate && !isOwnProfile) {
            const viewerUserId = currentUser?.id || currentUser?._id;
            const isViewerMember = groupService.isMember(group, viewerUserId);
            
            if (!isViewerMember) {
              console.log(`Skipping private group ${group.name} - viewer is not a member`);
              continue; // דילוג על הקבוצה הפרטית
            }
          }
          
          const groupPostsResult = await groupService.getGroupPosts(group._id, userId);
          
          if (groupPostsResult.success && groupPostsResult.data) {
            const userPostsInGroup = groupPostsResult.data.filter(post => 
              post.userId === userId || 
              post.user?.id === userId || 
              post.user?._id === userId
            );
            
            const postsWithGroupInfo = userPostsInGroup.map(post => ({
              ...post,
              groupName: group.name,
              groupId: group._id,
              isPrivateGroup: group.isPrivate // מידע נוסף לזיהוי
            }));
            
            allGroupPosts = [...allGroupPosts, ...postsWithGroupInfo];
            console.log(`Found ${userPostsInGroup.length} posts in group ${group.name}`);
          }
        } catch (groupPostError) {
          console.log(`Could not load posts for group ${group.name}:`, groupPostError);
          continue;
        }
      }

      console.log(`Total accessible group posts found: ${allGroupPosts.length}`);
      
      return {
        success: true,
        data: allGroupPosts
      };
      
    } catch (error) {
      console.error('Error loading user group posts:', error);
      return { success: false, data: [] };
    }
  };

  const loadUserPosts = async () => {
    try {
      console.log('Loading user posts including group posts with privacy checks');
      console.log(`Loading for user: ${userId}, Viewer: ${currentUser?.id || currentUser?._id}, isOwnProfile: ${isOwnProfile}`);
      
      const regularPostsResult = await recipeService.getAllRecipes();
      let allPosts = [];
      
      if (regularPostsResult.success) {
        const regularPosts = Array.isArray(regularPostsResult.data) ? regularPostsResult.data : [];
        const userRegularPosts = regularPosts.filter(post => 
          post.userId === userId || 
          post.user?.id === userId || 
          post.user?._id === userId
        );
        
        const markedRegularPosts = userRegularPosts.map(post => ({
          ...post,
          postSource: 'personal'
        }));
        
        allPosts = [...markedRegularPosts];
        console.log('Regular posts loaded:', markedRegularPosts.length);
      }

      try {
        const groupPostsResult = await loadUserGroupPosts();
        
        if (groupPostsResult.success && groupPostsResult.data) {
          const userGroupPosts = groupPostsResult.data.map(post => ({
            ...post,
            postSource: 'group'
          }));
          
          allPosts = [...allPosts, ...userGroupPosts];
          console.log('Accessible group posts loaded:', userGroupPosts.length);
        }
      } catch (groupError) {
        console.log('Could not load group posts:', groupError);
      }

      console.log('Total user posts loaded (with privacy filtering):', allPosts.length);

      const sortedPosts = allPosts.sort((a, b) => 
        new Date(b.createdAt) - new Date(a.createdAt)
      );

      setUserPosts(sortedPosts);
      await calculateUserStatistics(sortedPosts);
      
    } catch (error) {
      console.error('Error loading user posts:', error);
      Alert.alert('Error', 'Failed to load posts');
    }
  };

  const calculateUserStatistics = async (posts) => {
    try {
      console.log('Calculating user statistics using statistics service');
      
      const statsData = statisticsService.processRealUserData(posts, userId);
      
      let followersCount = 0;
      try {
        const followersResult = await statisticsService.getFollowersGrowth(userId);
        if (followersResult.success && followersResult.data) {
          followersCount = followersResult.currentFollowersCount || 0;
          console.log('Real followers data retrieved successfully');
        } else {
          console.log('No followers data available from server');
        }
      } catch (followersError) {
        console.log('Could not fetch followers data from server');
        followersCount = 0;
      }

      setStats({
        postsCount: statsData.totalPosts,
        likesCount: statsData.totalLikes,
        followersCount: followersCount
      });

      console.log('Statistics calculated:', {
        posts: statsData.totalPosts,
        likes: statsData.totalLikes,
        followers: followersCount
      });

    } catch (error) {
      
      const totalLikes = posts.reduce((sum, post) => 
        sum + (post.likes ? post.likes.length : 0), 0
      );

      setStats(prev => ({
        ...prev,
        postsCount: posts.length,
        likesCount: totalLikes
      }));
    }
  };

  const handleFollowToggle = async () => {
    if (isFollowLoading || !currentUser?.id) return;
    
    setIsFollowLoading(true);
    try {
      console.log('Toggling follow status');
      
      const result = await chatService.toggleFollow(
        userId,
        currentUser.id || currentUser._id,
        isFollowing
      );
      
      if (result.success) {
        setIsFollowing(!isFollowing);
        setStats(prev => ({
          ...prev,
          followersCount: result.data.followersCount
        }));
        
        Alert.alert(
          'Success', 
          isFollowing ? 'Unfollowed successfully' : 'Following successfully!'
        );
        
        console.log('Follow status updated successfully');
      } else {
        Alert.alert('Error', result.message || 'Failed to update follow status');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update follow status');
    } finally {
      setIsFollowLoading(false);
    }
  };

  const handleStartChat = async () => {
    if (isOwnProfile) {
      Alert.alert('Info', 'You cannot chat with yourself!');
      return;
    }

    if (!profileUser) {
      Alert.alert('Error', 'User information not available');
      return;
    }

    setStartingChat(true);

    try {
      console.log('Starting chat with user');
      
      const result = await chatService.getOrCreatePrivateChat(userId);
      
      if (result.success) {
        navigation.navigate('ChatConversation', {
          chatId: result.data._id,
          otherUser: {
            userId: userId,
            userName: profileUser.fullName || profileUser.name || 'Unknown User',
            userAvatar: profileUser.avatar,
            isOnline: false
          }
        });
      } else {
        Alert.alert('Error', result.message || 'Failed to start chat');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to start chat');
    } finally {
      setStartingChat(false);
    }
  };

  const handleShowFollowers = async () => {
    try {
      navigation.navigate('FollowersList', {
        userId: userId,
        title: `${profileUser?.fullName || 'User'}'s Followers`,
        listType: 'followers'
      });
    } catch (error) {
    }
  };

  const handleViewStatistics = () => {
    console.log('Navigating to UserStatistics');
    
    navigation.navigate('UserStatistics', {
      currentUser: profileUser,
      userPosts: userPosts,
      userId: userId
    });
  };

  const handleRefreshData = useCallback(() => {
    loadUserPosts();
  }, [userId]);

  const handleEditProfile = () => {
    navigation.navigate('EditProfile');
  };

  const handleMyGroups = () => {
    navigation.navigate('Groups');
  };

  const handleSettings = () => {
    setShowSettingsModal(true);
  };

  const handleDeleteAccount = () => {
    setShowSettingsModal(false);
    
    Alert.alert(
      'Delete Account',
      'Are you absolutely sure you want to delete your account? This action cannot be undone and will permanently remove all your recipes, chats, and data.',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Yes, Delete',
          style: 'destructive',
          onPress: () => {
            setShowDeleteModal(true);
          }
        }
      ]
    );
  };

  const confirmDeleteAccount = async () => {
    if (!deletePassword.trim()) {
      Alert.alert('Error', 'Please enter your password to confirm deletion');
      return;
    }

    setIsDeleting(true);

    try {
      console.log('Attempting to delete user account');
      
      const result = await userService.deleteUserAccount(userId, deletePassword);
      
      if (result.success) {
        Alert.alert(
          'Account Deleted',
          'Your account has been permanently deleted. Thank you for using FlavorWorld.',
          [
            {
              text: 'OK',
              onPress: () => {
                setShowDeleteModal(false);
                logout(); 
              }
            }
          ],
          { cancelable: false }
        );
      } else {
        Alert.alert('Error', result.message || 'Failed to delete account. Please try again or contact support.');
      }
      
    } catch (error) {
      Alert.alert('Error', 'An error occurred while deleting your account. Please try again or contact support.');
    } finally {
      setIsDeleting(false);
    }
  };

  const getFilteredPosts = () => {
    switch (selectedTab) {
      case 'personal':
        return userPosts.filter(post => post.postSource === 'personal');
      case 'groups':
        return userPosts.filter(post => post.postSource === 'group');
      case 'posts':
      default:
        return userPosts; 
    }
  };

  const renderProfileHeader = () => (
    <View style={styles.profileHeader}>
      <View style={styles.profileImageContainer}>
        <UserAvatar
          uri={profileUser?.avatar || profileUser?.userAvatar}
          name={profileUser?.fullName || profileUser?.name}
          size={120}
        />
      </View>

      <View style={styles.profileInfo}>
        <Text style={styles.profileName}>
          {profileUser?.fullName || profileUser?.name || 'Anonymous Chef'}
        </Text>
        
        <Text style={styles.profileEmail}>
          {profileUser?.email || 'No email'}
        </Text>

        <Text style={styles.profileBio}>
          {profileUser?.bio || ' Passionate about cooking and sharing delicious recipes!'}
        </Text>
      </View>

      <View style={styles.statsContainer}>
        <TouchableOpacity 
          style={styles.statItem} 
         
        >
          <Text style={styles.statNumber}>{stats.postsCount}</Text>
          <Text style={styles.statLabel}>Recipes</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.statItem} 
         
        >
          <Text style={styles.statNumber}>{stats.likesCount}</Text>
          <Text style={styles.statLabel}>Total Likes</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.statItem} 
          
        >
          <Text style={styles.statNumber}>{stats.followersCount}</Text>
          <Text style={styles.statLabel}>Followers</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.actionButtons}>
        {isOwnProfile ? (
          <>
            <TouchableOpacity style={styles.editButton} onPress={handleEditProfile}>
              <Ionicons name="create-outline" size={18} color={FLAVORWORLD_COLORS.white} />
              <Text style={styles.editButtonText}>Edit Profile</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.settingsButton} onPress={handleSettings}>
              <Ionicons name="settings-outline" size={18} color={FLAVORWORLD_COLORS.accent} />
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity 
              style={[styles.chatButton, startingChat && styles.buttonDisabled]} 
              onPress={handleStartChat}
              disabled={startingChat}
            >
              {startingChat ? (
                <ActivityIndicator size="small" color={FLAVORWORLD_COLORS.white} />
              ) : (
                <Ionicons name="chatbubble-outline" size={18} color={FLAVORWORLD_COLORS.white} />
              )}
              <Text style={styles.chatButtonText}>
                {startingChat ? 'Starting...' : 'Chat'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[
                styles.followButton, 
                isFollowing && styles.followingButton,
                isFollowLoading && styles.followButtonDisabled
              ]}
              onPress={handleFollowToggle}
              disabled={isFollowLoading}
            >
              {isFollowLoading ? (
                <ActivityIndicator size="small" color={FLAVORWORLD_COLORS.white} />
              ) : (
                <>
                  <Ionicons 
                    name={isFollowing ? "checkmark" : "add"} 
                    size={16} 
                    color={FLAVORWORLD_COLORS.white} 
                  />
                  <Text style={styles.followButtonText}>
                    {isFollowing ? 'Following' : 'Follow'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>

      {isOwnProfile && (
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickActionItem} onPress={handleMyGroups}>
            <View style={styles.quickActionIcon}>
              <Ionicons name="people" size={20} color={FLAVORWORLD_COLORS.secondary} />
            </View>
            <Text style={styles.quickActionText}>My Groups</Text>
            <Ionicons name="chevron-forward" size={16} color={FLAVORWORLD_COLORS.textLight} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.quickActionItem} 
            onPress={() => navigation.navigate('ChatList')}
          >
            <View style={styles.quickActionIcon}>
              <Ionicons name="chatbubbles" size={20} color={FLAVORWORLD_COLORS.primary} />
            </View>
            <Text style={styles.quickActionText}>My Chats</Text>
            <Ionicons name="chevron-forward" size={16} color={FLAVORWORLD_COLORS.textLight} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.quickActionItem} 
            onPress={handleViewStatistics}
          >
            <View style={styles.quickActionIcon}>
              <Ionicons name="analytics" size={20} color={FLAVORWORLD_COLORS.accent} />
            </View>
            <Text style={styles.quickActionText}>My Statistics</Text>
            <Ionicons name="chevron-forward" size={16} color={FLAVORWORLD_COLORS.textLight} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderTabBar = () => (
    <View style={styles.tabBar}>
      <TouchableOpacity
        style={[styles.tab, selectedTab === 'posts' && styles.activeTab]}
        onPress={() => setSelectedTab('posts')}
      >
        <Ionicons 
          name="grid-outline" 
          size={20} 
          color={selectedTab === 'posts' ? FLAVORWORLD_COLORS.primary : FLAVORWORLD_COLORS.textLight} 
        />
        <Text style={[
          styles.tabText,
          selectedTab === 'posts' && styles.activeTabText
        ]}>All Recipes</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.tab, selectedTab === 'personal' && styles.activeTab]}
        onPress={() => setSelectedTab('personal')}
      >
        <Ionicons 
          name="person-outline" 
          size={20} 
          color={selectedTab === 'personal' ? FLAVORWORLD_COLORS.primary : FLAVORWORLD_COLORS.textLight} 
        />
        <Text style={[
          styles.tabText,
          selectedTab === 'personal' && styles.activeTabText
        ]}>Personal</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.tab, selectedTab === 'groups' && styles.activeTab]}
        onPress={() => setSelectedTab('groups')}
      >
        <Ionicons 
          name="people-outline" 
          size={20} 
          color={selectedTab === 'groups' ? FLAVORWORLD_COLORS.primary : FLAVORWORLD_COLORS.textLight} 
        />
        <Text style={[
          styles.tabText,
          selectedTab === 'groups' && styles.activeTabText
        ]}>Groups</Text>
      </TouchableOpacity>
    </View>
  );

  const renderPost = ({ item }) => (
    <View>
      {item.postSource === 'group' && (
        <View style={[
          styles.groupPostBadge,
          item.isPrivateGroup && styles.privateGroupPostBadge
        ]}>
          <Ionicons 
            name={item.isPrivateGroup ? "lock-closed" : "people"} 
            size={14} 
            color={item.isPrivateGroup ? FLAVORWORLD_COLORS.warning : FLAVORWORLD_COLORS.secondary} 
          />
          <Text style={[
            styles.groupPostBadgeText,
            item.isPrivateGroup && styles.privateGroupPostBadgeText
          ]}>
            Posted in {item.groupName || 'Group'} 
            {item.isPrivateGroup && ' (Private)'}
          </Text>
        </View>
      )}
      
      <PostComponent
        post={item}
        navigation={navigation}
        onRefreshData={handleRefreshData}
      />
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="restaurant-outline" size={80} color={FLAVORWORLD_COLORS.textLight} />
      <Text style={styles.emptyTitle}>
        {selectedTab === 'posts' ? 'No Recipes Yet' : 
         selectedTab === 'personal' ? 'No Personal Recipes' : 'No Group Recipes'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {selectedTab === 'posts' && isOwnProfile ? 
         'Share your first delicious recipe!' : 
         selectedTab === 'personal' ? 'Create your first personal recipe!' :
         'Join groups and start sharing recipes!'}
      </Text>
    </View>
  );

  const renderSettingsModal = () => (
    <Modal
      visible={showSettingsModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowSettingsModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.settingsModal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Settings</Text>
            <TouchableOpacity onPress={() => setShowSettingsModal(false)}>
              <Ionicons name="close" size={24} color={FLAVORWORLD_COLORS.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.settingsList}>
            <TouchableOpacity style={styles.settingItem}>
              <Ionicons name="shield-outline" size={20} color={FLAVORWORLD_COLORS.accent} />
              <Text style={styles.settingText}>Privacy</Text>
              <Ionicons name="chevron-forward" size={16} color={FLAVORWORLD_COLORS.textLight} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingItem}>
              <Ionicons name="help-circle-outline" size={20} color={FLAVORWORLD_COLORS.accent} />
              <Text style={styles.settingText}>Help & Support</Text>
              <Ionicons name="chevron-forward" size={16} color={FLAVORWORLD_COLORS.textLight} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingItem}>
              <Ionicons name="information-circle-outline" size={20} color={FLAVORWORLD_COLORS.accent} />
              <Text style={styles.settingText}>About</Text>
              <Ionicons name="chevron-forward" size={16} color={FLAVORWORLD_COLORS.textLight} />
            </TouchableOpacity>

            <View style={styles.settingDivider} />

            <TouchableOpacity 
              style={[styles.settingItem, styles.dangerItem]}
              onPress={handleDeleteAccount}
            >
              <Ionicons name="trash-outline" size={20} color={FLAVORWORLD_COLORS.danger} />
              <Text style={[styles.settingText, styles.dangerText]}>Delete Account</Text>
              <Ionicons name="chevron-forward" size={16} color={FLAVORWORLD_COLORS.danger} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderDeleteModal = () => (
    <Modal
      visible={showDeleteModal}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setShowDeleteModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.deleteModal}>
          <View style={styles.deleteModalHeader}>
            <Ionicons name="warning" size={48} color={FLAVORWORLD_COLORS.danger} />
            <Text style={styles.deleteModalTitle}>Delete Account</Text>
            <Text style={styles.deleteModalSubtitle}>
              This action cannot be undone. All your recipes, chats, and data will be permanently removed.
            </Text>
          </View>

          <View style={styles.deleteModalContent}>
            <Text style={styles.passwordLabel}>Enter your password to confirm:</Text>
            <TextInput
              style={styles.passwordInput}
              value={deletePassword}
              onChangeText={setDeletePassword}
              placeholder="Your password"
              secureTextEntry
              autoCapitalize="none"
              editable={!isDeleting}
            />
          </View>

          <View style={styles.deleteModalButtons}>
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={() => {
                setShowDeleteModal(false);
                setDeletePassword('');
              }}
              disabled={isDeleting}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.deleteButton, isDeleting && styles.deleteButtonDisabled]}
              onPress={confirmDeleteAccount}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color={FLAVORWORLD_COLORS.white} />
              ) : (
                <Text style={styles.deleteButtonText}>Delete Forever</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={FLAVORWORLD_COLORS.primary} />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={FLAVORWORLD_COLORS.accent} />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>
          {isOwnProfile ? 'My Profile' : profileUser?.fullName || 'Profile'}
        </Text>
        
        <View style={styles.headerRight}>
          {!isOwnProfile && (
            <TouchableOpacity 
              style={styles.headerChatButton}
              onPress={handleStartChat}
              disabled={startingChat}
            >
              {startingChat ? (
                <ActivityIndicator size="small" color={FLAVORWORLD_COLORS.accent} />
              ) : (
                <Ionicons name="chatbubble-outline" size={20} color={FLAVORWORLD_COLORS.accent} />
              )}
            </TouchableOpacity>
          )}
          
          <TouchableOpacity style={styles.menuButton}>
            <Ionicons name="ellipsis-horizontal" size={24} color={FLAVORWORLD_COLORS.accent} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={getFilteredPosts()}
        keyExtractor={(item) => item._id || item.id}
        renderItem={renderPost}
        ListHeaderComponent={() => (
          <View>
            {renderProfileHeader()}
            {renderTabBar()}
          </View>
        )}
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
      />

      {renderSettingsModal()}
      {renderDeleteModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: FLAVORWORLD_COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: FLAVORWORLD_COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: FLAVORWORLD_COLORS.border,
  },
  backButton: {
    padding: 8,
    backgroundColor: FLAVORWORLD_COLORS.background,
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: FLAVORWORLD_COLORS.text,
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerChatButton: {
    padding: 8,
    backgroundColor: FLAVORWORLD_COLORS.background,
    borderRadius: 20,
    marginRight: 8,
  },
  menuButton: {
    padding: 8,
    backgroundColor: FLAVORWORLD_COLORS.background,
    borderRadius: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: FLAVORWORLD_COLORS.textLight,
  },
  profileHeader: {
    backgroundColor: FLAVORWORLD_COLORS.white,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: FLAVORWORLD_COLORS.border,
  },
  profileImageContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  profileInfo: {
    alignItems: 'center',
    marginBottom: 20,
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: FLAVORWORLD_COLORS.text,
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 16,
    color: FLAVORWORLD_COLORS.textLight,
    marginBottom: 8,
  },
  profileBio: {
    fontSize: 16,
    color: FLAVORWORLD_COLORS.text,
    textAlign: 'center',
    lineHeight: 22,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
    paddingVertical: 16,
    backgroundColor: FLAVORWORLD_COLORS.background,
    borderRadius: 12,
  },
  statItem: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: FLAVORWORLD_COLORS.accent,
  },
  statLabel: {
    fontSize: 14,
    color: FLAVORWORLD_COLORS.textLight,
    marginTop: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: FLAVORWORLD_COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  editButtonText: {
    color: FLAVORWORLD_COLORS.white,
    fontWeight: '600',
    marginLeft: 8,
  },
  settingsButton: {
    padding: 10,
    backgroundColor: FLAVORWORLD_COLORS.background,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: FLAVORWORLD_COLORS.border,
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: FLAVORWORLD_COLORS.secondary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  chatButtonText: {
    color: FLAVORWORLD_COLORS.white,
    fontWeight: '600',
    marginLeft: 8,
  },
  followButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: FLAVORWORLD_COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  followingButton: {
    backgroundColor: FLAVORWORLD_COLORS.success,
  },
  followButtonDisabled: {
    opacity: 0.6,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  followButtonText: {
    color: FLAVORWORLD_COLORS.white,
    fontWeight: '600',
    marginLeft: 6,
  },
  quickActions: {
    backgroundColor: FLAVORWORLD_COLORS.background,
    borderRadius: 12,
    padding: 4,
  },
  quickActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: FLAVORWORLD_COLORS.white,
    marginVertical: 2,
    borderRadius: 8,
  },
  quickActionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: FLAVORWORLD_COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  quickActionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: FLAVORWORLD_COLORS.text,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: FLAVORWORLD_COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: FLAVORWORLD_COLORS.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: FLAVORWORLD_COLORS.primary,
  },
  tabText: {
    fontSize: 14,
    color: FLAVORWORLD_COLORS.textLight,
    marginLeft: 8,
    fontWeight: '500',
  },
  activeTabText: {
    color: FLAVORWORLD_COLORS.primary,
    fontWeight: '600',
  },
  groupPostBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: FLAVORWORLD_COLORS.background,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: FLAVORWORLD_COLORS.secondary,
  },
  groupPostBadgeText: {
    fontSize: 12,
    color: FLAVORWORLD_COLORS.secondary,
    fontWeight: '600',
    marginLeft: 6,
  },
  privateGroupPostBadge: {
    backgroundColor: '#FFF8E7', // רקע צהבהב לקבוצות פרטיות
    borderLeftColor: FLAVORWORLD_COLORS.warning,
  },
  privateGroupPostBadgeText: {
    color: FLAVORWORLD_COLORS.warning,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: FLAVORWORLD_COLORS.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: FLAVORWORLD_COLORS.textLight,
    textAlign: 'center',
    lineHeight: 22,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  settingsModal: {
    backgroundColor: FLAVORWORLD_COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: FLAVORWORLD_COLORS.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: FLAVORWORLD_COLORS.text,
  },
  settingsList: {
    padding: 20,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: FLAVORWORLD_COLORS.background,
    borderRadius: 12,
    marginBottom: 8,
  },
  settingText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: FLAVORWORLD_COLORS.text,
    marginLeft: 12,
  },
  settingDivider: {
    height: 1,
    backgroundColor: FLAVORWORLD_COLORS.border,
    marginVertical: 12,
  },
  dangerItem: {
    backgroundColor: '#FFF5F5',
  },
  dangerText: {
    color: FLAVORWORLD_COLORS.danger,
  },
  deleteModal: {
    backgroundColor: FLAVORWORLD_COLORS.white,
    borderRadius: 20,
    margin: 20,
    padding: 20,
  },
  deleteModalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  deleteModalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: FLAVORWORLD_COLORS.danger,
    marginTop: 12,
    marginBottom: 8,
  },
  deleteModalSubtitle: {
    fontSize: 16,
    color: FLAVORWORLD_COLORS.textLight,
    textAlign: 'center',
    lineHeight: 22,
  },
  deleteModalContent: {
    marginBottom: 20,
  },
  passwordLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: FLAVORWORLD_COLORS.text,
    marginBottom: 8,
  },
  passwordInput: {
    borderWidth: 1,
    borderColor: FLAVORWORLD_COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: FLAVORWORLD_COLORS.background,
  },
  deleteModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: FLAVORWORLD_COLORS.border,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: FLAVORWORLD_COLORS.text,
  },
  deleteButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: FLAVORWORLD_COLORS.danger,
    alignItems: 'center',
  },
  deleteButtonDisabled: {
    opacity: 0.6,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: FLAVORWORLD_COLORS.white,
  },
});

export default ProfileScreen;