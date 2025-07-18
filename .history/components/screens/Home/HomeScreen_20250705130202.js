import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  SafeAreaView,
  StatusBar,
  Share,
  TouchableOpacity,
  Image,
  Modal,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../services/AuthContext';
import { recipeService } from '../../../services/recipeService';
import { notificationService } from '../../../services/NotificationService'; // 🆕 הוסף import
import PostComponent from '../../common/PostComponent';
import CreatePostComponent from '../../common/CreatePostComponent';
import SharePostComponent from '../../common/SharePostComponent';
import UserAvatar from '../../common/UserAvatar';
import { chatService } from '../../../services/chatServices';

// צבעי FlavorWorld
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
  info: '#3498DB'
};

const HomeScreen = ({ navigation }) => {
  const { logout, currentUser, isLoading: authLoading } = useAuth();
  const [posts, setPosts] = useState([]);
  const [filteredPosts, setFilteredPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [sharePost, setSharePost] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0); // 🆕 הוסף state להתראות
  const [feedType, setFeedType] = useState('personalized'); // 🆕 סוג הפיד
  
  // מיון ומסננים
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedMeatType, setSelectedMeatType] = useState('all');
  const [selectedCookingTime, setSelectedCookingTime] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  // קטגוריות זמינות
  const categories = [
    'all', 'Asian', 'Italian', 'Mexican', 'Indian', 'Mediterranean', 
    'American', 'French', 'Chinese', 'Japanese', 'Thai', 
    'Middle Eastern', 'Greek', 'Spanish', 'Korean', 'Vietnamese', 'Dessert'
  ];
  
  const meatTypes = [
    'all', 'Vegetarian', 'Vegan', 'Chicken', 'Beef', 'Pork', 
    'Fish', 'Seafood', 'Lamb', 'Turkey', 'Mixed'
  ];
  
  const cookingTimes = [
    { key: 'all', label: 'All Times' },
    { key: 'quick', label: 'Under 30 min', max: 30 },
    { key: 'medium', label: '30-60 min', min: 30, max: 60 },
    { key: 'long', label: '1-2 hours', min: 60, max: 120 },
    { key: 'very_long', label: 'Over 2 hours', min: 120 }
  ];

  // 🆕 סוגי פיד
  const feedTypes = [
    { key: 'personalized', label: 'Following & Groups', icon: 'people-outline' },
    { key: 'all', label: 'All Posts', icon: 'globe-outline' },
    { key: 'following', label: 'Following Only', icon: 'heart-outline' }
  ];

  // פונקציות צ'אט
  const loadUnreadChatCount = useCallback(async () => {
    try {
      const result = await chatService.getUnreadChatsCount();
      if (result.success) {
        setUnreadChatCount(result.count);
      }
    } catch (error) {
      console.error('Load unread count error:', error);
    }
  }, []);

  // 🆕 פונקציות התראות
  const loadUnreadNotificationsCount = useCallback(async () => {
    try {
      const userId = currentUser?.id || currentUser?._id;
      if (userId) {
        const result = await notificationService.getUnreadCount(userId);
        if (result.success) {
          setUnreadNotificationsCount(result.count);
        }
      }
    } catch (error) {
      console.error('Load unread notifications count error:', error);
    }
  }, [currentUser]);

  const handleNavigateToNotifications = () => {
    if (navigation) {
      navigation.navigate('Notifications');
    }
  };

  const initializeChatService = useCallback(async () => {
    const userId = currentUser?.id || currentUser?._id;
    if (userId) {
      await chatService.initializeSocket(userId);
      loadUnreadChatCount();
    }
  }, [currentUser, loadUnreadChatCount]);

  const handleOpenChats = useCallback(() => {
    navigation.navigate('ChatList');
  }, [navigation]);

  if (authLoading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={FLAVORWORLD_COLORS.primary} />
        <Text style={styles.loaderText}>Loading...</Text>
      </SafeAreaView>
    );
  } 

  // פונקציה למיון ומסנן
  const applyFiltersAndSort = useCallback((postsArray) => {
    let filtered = [...postsArray];

    // מסנן קטגוריה
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(post => 
        post.category?.toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    // מסנן סוג בשר/מטבח
    if (selectedMeatType !== 'all') {
      filtered = filtered.filter(post => 
        post.meatType?.toLowerCase() === selectedMeatType.toLowerCase()
      );
    }

    // מסנן זמן הכנה
    if (selectedCookingTime !== 'all') {
      const timeFilter = cookingTimes.find(t => t.key === selectedCookingTime);
      if (timeFilter) {
        filtered = filtered.filter(post => {
          const cookTime = parseInt(post.prepTime) || parseInt(post.preparationTime) || parseInt(post.cookingTime) || 0;
          if (timeFilter.max && timeFilter.min) {
            return cookTime >= timeFilter.min && cookTime <= timeFilter.max;
          } else if (timeFilter.max) {
            return cookTime <= timeFilter.max;
          } else if (timeFilter.min) {
            return cookTime >= timeFilter.min;
          }
          return true;
        });
      }
    }

    // מיון
    switch (sortBy) {
      case 'oldest':
        filtered.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        break;
      case 'popular':
        filtered.sort((a, b) => (b.likes?.length || 0) - (a.likes?.length || 0));
        break;
      case 'newest':
      default:
        filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        break;
    }

    return filtered;
  }, [selectedCategory, selectedMeatType, selectedCookingTime, sortBy]);

  // עדכון המסנן כאשר משתנים הפרמטרים
  useEffect(() => {
    const filtered = applyFiltersAndSort(posts);
    setFilteredPosts(filtered);
  }, [posts, applyFiltersAndSort]);

  // 🆕 טעינת פוסטים לפי סוג הפיד
  const loadPosts = useCallback(async () => {
      try {
        const userId = currentUser?.id || currentUser?._id;
        
        if (!userId) {
          console.error('No user ID available - user probably logged out');
          setLoading(false);
          setRefreshing(false);
          // אל תחזיר, תטען פוסטים כלליים במקום
          const result = await recipeService.getAllRecipes();
          if (result.success) {
            const postsArray = Array.isArray(result.data) ? result.data : [];
            const formattedPosts = postsArray.map(post => ({
              ...post,
              _id: post._id || post.id,
              userName: post.userName || 'Anonymous',
              userAvatar: post.userAvatar || null,
              likes: Array.isArray(post.likes) ? post.likes : [],
              comments: Array.isArray(post.comments) ? post.comments : [],
              createdAt: post.createdAt || new Date().toISOString(),
              postSource: 'personal',
              groupName: null,
              isLiked: false
            }));
            setPosts(formattedPosts);
          }
          return;
        }

      let result;
      
      switch (feedType) {
        case 'personalized':
          console.log('📥 Loading personalized feed...');
          result = await recipeService.getFeed(userId);
          break;
          
        case 'following':
          console.log('📥 Loading following posts...');
          result = await recipeService.getFollowingPosts(userId);
          break;
          
        case 'all':
        default:
          console.log('📥 Loading all posts...');
          result = await recipeService.getAllRecipes();
          break;
      }
      
      if (result.success) {
        const postsArray = Array.isArray(result.data) ? result.data : [];
        
        const formattedPosts = postsArray.map(post => ({
          ...post,
          _id: post._id || post.id,
          userName: post.userName || post.user?.name || post.author?.name || 'Anonymous',
          userAvatar: post.userAvatar || post.user?.avatar || post.author?.avatar || null,
          likes: Array.isArray(post.likes) ? post.likes : [],
          comments: Array.isArray(post.comments) ? post.comments : [],
          createdAt: post.createdAt || post.created_at || new Date().toISOString(),
          // 🆕 הוסף מידע על מקור הפוסט
          postSource: post.groupId ? 'group' : 'personal',
          groupName: post.groupName || null,
          // 🆕 הוסף מידע על סטטוס לייק
          isLiked: post.likes ? post.likes.includes(userId) : false
        }));
        
        console.log(`✅ Loaded ${formattedPosts.length} posts for feed type: ${feedType}`);
        setPosts(formattedPosts);
      } else {
        Alert.alert('Error', `Failed to load posts: ${result.message}`);
      }
    } catch (error) {
      console.error('❌ Load posts error:', error);
      Alert.alert('Error', `Failed to load posts: ${error.message}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [feedType, currentUser]);

  useEffect(() => {
    // רק אם יש משתמש מחובר
    if (currentUser?.id || currentUser?._id) {
      loadPosts();
      loadUnreadNotificationsCount(); // 🆕 הוסף טעינת התראות
    } else {
      // אם אין משתמש, נקה הכל
      setPosts([]);
      setFilteredPosts([]);
      setLoading(false);
      setUnreadNotificationsCount(0); // 🆕 נקה התראות
    }
  }, [currentUser, feedType, loadPosts, loadUnreadNotificationsCount]);

  // אתחול צ'אט בעת טעינת הקומפוננטה
  useEffect(() => {
    if (currentUser?.id || currentUser?._id) {
      initializeChatService();
    }
  }, [currentUser, initializeChatService]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadPosts();
    loadUnreadChatCount();
    loadUnreadNotificationsCount(); // 🆕 הוסף רענון התראות
  }, [loadPosts, loadUnreadChatCount, loadUnreadNotificationsCount]);

  const handleRefreshData = useCallback(async () => {
    await loadPosts();
  }, [loadPosts]);

  const handleLogout = useCallback(() => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: async () => {
            try {
              chatService.disconnect();
              await logout();
            } catch (error) {
              Alert.alert('Error', 'Failed to logout');
            }
          }
        }
      ]
    );
  }, [logout]);

  const handleNavigateToProfile = () => {
    if (navigation) {
      navigation.navigate('Profile', { userId: currentUser?.id || currentUser?._id });
    }
  };

  const handleNavigateToSearch = () => {
    if (navigation) {
      navigation.navigate('Search');
    }
  };

  const clearAllFilters = () => {
    setSelectedCategory('all');
    setSelectedMeatType('all');
    setSelectedCookingTime('all');
    setSortBy('newest');
    setShowFilters(false);
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (selectedCategory !== 'all') count++;
    if (selectedMeatType !== 'all') count++;
    if (selectedCookingTime !== 'all') count++;
    if (sortBy !== 'newest') count++;
    return count;
  };

  const handlePostCreated = useCallback((newPost) => {
    handleRefreshData();
  }, [handleRefreshData]);

  const handlePostDelete = useCallback(async (postId) => {
    try {
      const result = await recipeService.deleteRecipe(postId);
      
      if (result.success) {
        handleRefreshData();
        Alert.alert('Success', 'Recipe deleted successfully');
      } else {
        Alert.alert('Error', result.message || 'Failed to delete recipe');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to delete recipe');
    }
  }, [handleRefreshData]);

  const handleShare = useCallback((post) => {
    setSharePost(post);
    setShowShareModal(true);
  }, []);

  const handleSystemShare = useCallback(async (post) => {
    try {
      const shareContent = {
        message: `Check out this amazing recipe: ${post.title}\n\n${post.description}`,
        title: post.title,
      };
      
      await Share.share(shareContent);
    } catch (error) {
      console.error('Share error:', error);
    }
  }, []);

  const handleShareModalClose = useCallback(() => {
    setShowShareModal(false);
    setSharePost(null);
  }, []);

  const handleShareSubmit = useCallback((shareData) => {
    Alert.alert('Success', 'Recipe shared successfully!');
    handleShareModalClose();
  }, [handleShareModalClose]);

  // 🆕 רינדור בוחר סוג פיד
  const renderFeedTypeSelector = () => (
    <View style={styles.feedTypeContainer}>
      <Text style={styles.feedTypeTitle}>What would you like to see?</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.feedTypeScroll}>
        {feedTypes.map(type => (
          <TouchableOpacity
            key={type.key}
            style={[styles.feedTypeChip, feedType === type.key && styles.activeFeedTypeChip]}
            onPress={() => setFeedType(type.key)}
          >
            <Ionicons 
              name={type.icon} 
              size={18} 
              color={feedType === type.key ? FLAVORWORLD_COLORS.white : FLAVORWORLD_COLORS.primary} 
            />
            <Text style={[styles.feedTypeChipText, feedType === type.key && styles.activeFeedTypeChipText]}>
              {type.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderFilters = () => (
    showFilters && (
      <View style={styles.filtersContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {/* מיון */}
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Sort:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {[
                { key: 'newest', label: 'Newest' },
                { key: 'oldest', label: 'Oldest' },
                { key: 'popular', label: 'Popular' }
              ].map(sort => (
                <TouchableOpacity
                  key={sort.key}
                  style={[styles.filterChip, sortBy === sort.key && styles.activeFilterChip]}
                  onPress={() => setSortBy(sort.key)}
                >
                  <Text style={[styles.filterChipText, sortBy === sort.key && styles.activeFilterChipText]}>
                    {sort.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* קטגוריות */}
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Category:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {categories.map(category => (
                <TouchableOpacity
                  key={category}
                  style={[styles.filterChip, selectedCategory === category && styles.activeFilterChip]}
                  onPress={() => setSelectedCategory(category)}
                >
                  <Text style={[styles.filterChipText, selectedCategory === category && styles.activeFilterChipText]}>
                    {category === 'all' ? 'All' : category}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* סוג בשר/מטבח */}
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Type:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {meatTypes.map(meatType => (
                <TouchableOpacity
                  key={meatType}
                  style={[styles.filterChip, selectedMeatType === meatType && styles.activeFilterChip]}
                  onPress={() => setSelectedMeatType(meatType)}
                >
                  <Text style={[styles.filterChipText, selectedMeatType === meatType && styles.activeFilterChipText]}>
                    {meatType === 'all' ? 'All' : meatType}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* זמן הכנה */}
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Prep Time:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {cookingTimes.map(time => (
                <TouchableOpacity
                  key={time.key}
                  style={[styles.filterChip, selectedCookingTime === time.key && styles.activeFilterChip]}
                  onPress={() => setSelectedCookingTime(time.key)}
                >
                  <Text style={[styles.filterChipText, selectedCookingTime === time.key && styles.activeFilterChipText]}>
                    {time.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </ScrollView>

        {/* כפתור ניקוי כל המסננים */}
        {getActiveFiltersCount() > 0 && (
          <TouchableOpacity style={styles.clearFiltersButton} onPress={clearAllFilters}>
            <Ionicons name="refresh" size={16} color={FLAVORWORLD_COLORS.white} />
            <Text style={styles.clearFiltersText}>Clear All Filters</Text>
          </TouchableOpacity>
        )}

        {/* תוצאות */}
        <View style={styles.searchStats}>
          <Text style={styles.searchStatsText}>
            {getActiveFiltersCount() > 0 ? `${filteredPosts.length} recipes found` : `${posts.length} total recipes`}
          </Text>
        </View>
      </View>
    )
  );

  const renderCreatePost = useCallback(() => (
    <View style={styles.createPostContainer}>
      <View style={styles.createPostHeader}>
        <UserAvatar
          uri={currentUser?.avatar || currentUser?.userAvatar}
          name={currentUser?.fullName || currentUser?.name}
          size={40}
          onPress={handleNavigateToProfile}
        />
        <TouchableOpacity 
          style={styles.createPostInput}
          onPress={() => setShowCreateModal(true)}
        >
          <Text style={styles.createPostPlaceholder}>
            What delicious recipe will you share today?
          </Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.createPostActions}>
        <TouchableOpacity 
          style={styles.createPostButton}
          onPress={() => setShowCreateModal(true)}
        >
          <Ionicons name="restaurant-outline" size={20} color={FLAVORWORLD_COLORS.primary} />
          <Text style={styles.createPostButtonText}>Recipe</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.createPostButton}
          onPress={() => setShowCreateModal(true)}
        >
          <Ionicons name="camera-outline" size={20} color={FLAVORWORLD_COLORS.secondary} />
          <Text style={styles.createPostButtonText}>Photo</Text>
        </TouchableOpacity>
      </View>
    </View>
  ), [currentUser, handleNavigateToProfile]);

  const renderPost = useCallback(({ item, index }) => {
    return (
      <View style={styles.postContainer}>
        {/* 🆕 הוסף תווית מקור הפוסט */}
        {item.postSource === 'group' && item.groupName && (
          <View style={styles.postSourceLabel}>
            <Ionicons name="chatbubbles" size={14} color={FLAVORWORLD_COLORS.secondary} />
            <Text style={styles.postSourceText}>from {item.groupName}</Text>
          </View>
        )}
        
        <PostComponent
          post={item || {}}
          navigation={navigation}
          onDelete={handlePostDelete}
          onShare={() => handleSystemShare(item)}
          onShareCustom={() => handleShare(item)}
          onRefreshData={handleRefreshData}
        />
      </View>
    );
  }, [handlePostDelete, handleSystemShare, handleShare, handleRefreshData, navigation]);

  const renderEmptyComponent = useCallback(() => (
    !loading && (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIcon}>
          <Ionicons 
            name={getActiveFiltersCount() > 0 ? "options-outline" : 
                  feedType === 'personalized' ? "people-outline" :
                  feedType === 'following' ? "heart-outline" : "restaurant-outline"}
            size={80} 
            color={FLAVORWORLD_COLORS.textLight} 
          />
        </View>
        <Text style={styles.emptyTitle}>
          {getActiveFiltersCount() > 0 ? 'No Recipes Found' :
           feedType === 'personalized' ? 'Your Feed is Empty' :
           feedType === 'following' ? 'No Posts from Following' : 'No Recipes Yet!'}
        </Text>
        <Text style={styles.emptySubtitle}>
          {getActiveFiltersCount() > 0
            ? 'No recipes match your filter criteria. Try adjusting your filters.'
            : feedType === 'personalized'
            ? 'Follow some chefs or join groups to see their amazing recipes here!'
            : feedType === 'following'
            ? 'Follow some amazing chefs to see their recipes in your feed.'
            : 'Be the first to share your amazing recipe with the FlavorWorld community'
          }
        </Text>
        {(getActiveFiltersCount() === 0 && feedType !== 'following' && feedType !== 'groups') && (
          <TouchableOpacity 
            style={styles.emptyButton}
            onPress={() => setShowCreateModal(true)}
          >
            <Text style={styles.emptyButtonText}>Share Recipe</Text>
          </TouchableOpacity>
        )}
        {feedType === 'following' && (
          <TouchableOpacity 
            style={styles.emptyButton}
            onPress={handleNavigateToSearch}
          >
            <Text style={styles.emptyButtonText}>Find Chefs to Follow</Text>
          </TouchableOpacity>
        )}
      </View>
    )
  ), [loading, getActiveFiltersCount, feedType, handleNavigateToSearch, navigation]);

  const renderLoader = useCallback(() => (
    loading && (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={FLAVORWORLD_COLORS.primary} />
        <Text style={styles.loaderText}>
          {feedType === 'personalized' ? 'Loading your personalized feed...' :
           feedType === 'following' ? 'Loading posts from chefs you follow...' : 'Loading delicious recipes...'}
        </Text>
      </View>
    )
  ), [loading, feedType]);

  const ItemSeparatorComponent = useCallback(() => (
    <View style={styles.separator} />
  ), []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={FLAVORWORLD_COLORS.white} />
      
      {/* Header עליון נקי */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>FlavorWorld</Text>
        <View style={styles.headerButtons}>
          {/* כפתור חיפוש */}
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={handleNavigateToSearch}
          >
            <Ionicons name="search-outline" size={24} color={FLAVORWORLD_COLORS.accent} />
          </TouchableOpacity>
          
          {/* כפתור מסננים */}
          <TouchableOpacity 
            style={[styles.headerButton, showFilters && styles.activeButton]}
            onPress={() => setShowFilters(!showFilters)}
          >
            <Ionicons 
              name="options-outline" 
              size={24} 
              color={showFilters ? FLAVORWORLD_COLORS.white : FLAVORWORLD_COLORS.accent} 
            />
            {getActiveFiltersCount() > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{getActiveFiltersCount()}</Text>
              </View>
            )}
          </TouchableOpacity>
          
          {/* כפתור יצירה */}
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={24} color={FLAVORWORLD_COLORS.danger} />
          </TouchableOpacity>
        </View>
      </View>
      
      {/* 🆕 בוחר סוג פיד */}
      {renderFeedTypeSelector()}
      
      {/* מסננים */}
      {renderFilters()}
      
      <FlatList
        data={filteredPosts}
        keyExtractor={(item) => item._id || item.id || Math.random().toString()}
        renderItem={renderPost}
        ListHeaderComponent={!showFilters ? renderCreatePost : null}
        ListEmptyComponent={renderEmptyComponent}
        ItemSeparatorComponent={ItemSeparatorComponent}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={[FLAVORWORLD_COLORS.primary]}
            tintColor={FLAVORWORLD_COLORS.primary}
          />
        }
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        maxToRenderPerBatch={5}
        windowSize={10}
        initialNumToRender={3}
        style={styles.flatListContainer}
      />

      {/* 🆕 Bottom Navigation עם התראות */}
      <View style={styles.bottomNavigation}>
        <TouchableOpacity 
          style={styles.bottomNavItem}
          onPress={handleNavigateToNotifications}
        >
          <View style={styles.bottomNavIcon}>
            <Ionicons name="notifications-outline" size={24} color={FLAVORWORLD_COLORS.text} />
            {unreadNotificationsCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.bottomNavLabel}>Notifications</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.bottomNavItem}
          onPress={handleNavigateToProfile}
        >
          <View style={styles.bottomNavIconProfile}>
            <UserAvatar
              uri={currentUser?.avatar || currentUser?.userAvatar}
              name={currentUser?.fullName || currentUser?.name}
              size={28}
            />
          </View>
          <Text style={styles.bottomNavLabel}>Profile</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.bottomNavItem}
          onPress={handleOpenChats}
        >
          <View style={styles.bottomNavIconChat}>
            <Ionicons name="chatbubbles-outline" size={24} color={FLAVORWORLD_COLORS.white} />
            {unreadChatCount > 0 && (
              <View style={styles.chatBadge}>
                <Text style={styles.chatBadgeText}>
                  {unreadChatCount > 99 ? '99+' : unreadChatCount}
                </Text>
              </View>
            )}
          </View>
          <Text style={[styles.bottomNavLabel, styles.bottomNavLabelActive]}>Messages</Text>
        </TouchableOpacity>
      </View>

      {/* מודל יצירת פוסט מלא */}
      {showCreateModal && (
        <Modal
          visible={showCreateModal}
          animationType="slide"
          onRequestClose={() => setShowCreateModal(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity 
                onPress={() => setShowCreateModal(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={FLAVORWORLD_COLORS.accent} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Share Recipe</Text>
              <View style={styles.modalPlaceholder} />
            </View>
            
            <CreatePostComponent
              currentUser={currentUser}
              onPostCreated={(newPost) => {
                handlePostCreated(newPost);
                setShowCreateModal(false);
              }}
            />
          </View>
        </Modal>
      )}

      {/* מודל שיתוף מותאם אישית */}
      {showShareModal && sharePost && (
        <SharePostComponent
          visible={showShareModal}
          onClose={handleShareModalClose}
          post={sharePost}
          onShare={handleShareSubmit}
          currentUserId={currentUser?.id}
        />
      )}

      {renderLoader()}
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
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: FLAVORWORLD_COLORS.accent,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: 8,
    marginLeft: 8,
    backgroundColor: FLAVORWORLD_COLORS.background,
    borderRadius: 20,
    position: 'relative',
  },
  activeButton: {
    backgroundColor: FLAVORWORLD_COLORS.primary,
  },
  filterBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: FLAVORWORLD_COLORS.danger,
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadgeText: {
    color: FLAVORWORLD_COLORS.white,
    fontSize: 10,
    fontWeight: 'bold',
  },
  logoutButton: {
    padding: 8,
    marginLeft: 8,
    backgroundColor: FLAVORWORLD_COLORS.background,
    borderRadius: 20,
  },
  // 🆕 סטיילים לבוחר סוג פיד
  feedTypeContainer: {
    backgroundColor: FLAVORWORLD_COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: FLAVORWORLD_COLORS.border,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  feedTypeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: FLAVORWORLD_COLORS.text,
    marginBottom: 8,
  },
  feedTypeScroll: {
    flexDirection: 'row',
  },
  feedTypeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: FLAVORWORLD_COLORS.background,
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 12,
    borderWidth: 2,
    borderColor: FLAVORWORLD_COLORS.primary,
  },
  activeFeedTypeChip: {
    backgroundColor: FLAVORWORLD_COLORS.primary,
    borderColor: FLAVORWORLD_COLORS.primary,
  },
  feedTypeChipText: {
    fontSize: 14,
    color: FLAVORWORLD_COLORS.primary,
    fontWeight: '600',
    marginLeft: 6,
  },
  activeFeedTypeChipText: {
    color: FLAVORWORLD_COLORS.white,
  },
  flatListContainer: {
    flex: 1,
    marginBottom: 80, // מקום לbottom navigation
  },
  // 🆕 סטיילים למקור הפוסט
  postSourceLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: FLAVORWORLD_COLORS.background,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 15,
    alignSelf: 'flex-start',
  },
  postSourceText: {
    fontSize: 12,
    color: FLAVORWORLD_COLORS.secondary,
    fontWeight: '600',
    marginLeft: 4,
  },
  // Bottom Navigation Styles
  bottomNavigation: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: FLAVORWORLD_COLORS.white,
    borderTopWidth: 1,
    borderTopColor: FLAVORWORLD_COLORS.border,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  bottomNavItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  bottomNavIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: FLAVORWORLD_COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    position: 'relative', // 🆕 הוסף position לבadge
  },
  bottomNavIconProfile: {
    marginBottom: 4,
  },
  bottomNavIconChat: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: FLAVORWORLD_COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    position: 'relative',
  },
  bottomNavLabel: {
    fontSize: 12,
    color: FLAVORWORLD_COLORS.textLight,
    fontWeight: '500',
  },
  bottomNavLabelActive: {
    color: FLAVORWORLD_COLORS.primary,
    fontWeight: '600',
  },
  // 🆕 סטיילים להתראות
  notificationBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: FLAVORWORLD_COLORS.danger,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  notificationBadgeText: {
    color: FLAVORWORLD_COLORS.white,
    fontSize: 11,
    fontWeight: '600',
  },
  chatBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: FLAVORWORLD_COLORS.danger,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  chatBadgeText: {
    color: FLAVORWORLD_COLORS.white,
    fontSize: 11,
    fontWeight: '600',
  },
  filtersContainer: {
    backgroundColor: FLAVORWORLD_COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: FLAVORWORLD_COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  filterGroup: {
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: FLAVORWORLD_COLORS.text,
    marginBottom: 8,
  },
  filterChip: {
    backgroundColor: FLAVORWORLD_COLORS.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: FLAVORWORLD_COLORS.border,
  },
  activeFilterChip: {
    backgroundColor: FLAVORWORLD_COLORS.primary,
    borderColor: FLAVORWORLD_COLORS.primary,
  },
  filterChipText: {
    fontSize: 14,
    color: FLAVORWORLD_COLORS.text,
    fontWeight: '500',
  },
  activeFilterChipText: {
    color: FLAVORWORLD_COLORS.white,
  },
  clearFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: FLAVORWORLD_COLORS.danger,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  clearFiltersText: {
    color: FLAVORWORLD_COLORS.white,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  searchStats: {
    alignItems: 'center',
    marginTop: 8,
  },
  searchStatsText: {
    fontSize: 12,
    color: FLAVORWORLD_COLORS.textLight,
    fontWeight: '500',
  },
  createPostContainer: {
    backgroundColor: FLAVORWORLD_COLORS.white,
    marginBottom: 8,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  createPostHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  createPostInput: {
    flex: 1,
    backgroundColor: FLAVORWORLD_COLORS.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: FLAVORWORLD_COLORS.border,
    marginLeft: 12,
  },
  createPostPlaceholder: {
    fontSize: 16,
    color: FLAVORWORLD_COLORS.textLight,
  },
  createPostActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: FLAVORWORLD_COLORS.border,
  },
  createPostButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: FLAVORWORLD_COLORS.background,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: FLAVORWORLD_COLORS.border,
  },
  createPostButtonText: {
    fontSize: 14,
    color: FLAVORWORLD_COLORS.text,
    marginLeft: 6,
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: FLAVORWORLD_COLORS.white,
    paddingTop: 50,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: FLAVORWORLD_COLORS.border,
    backgroundColor: FLAVORWORLD_COLORS.white,
  },
  modalCloseButton: {
    padding: 8,
    backgroundColor: FLAVORWORLD_COLORS.background,
    borderRadius: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: FLAVORWORLD_COLORS.text,
  },
  modalPlaceholder: {
    width: 32,
  },
  postContainer: {
    backgroundColor: FLAVORWORLD_COLORS.white,
    marginHorizontal: 0,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  separator: {
    height: 8,
    backgroundColor: FLAVORWORLD_COLORS.background,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    marginBottom: 20,
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: FLAVORWORLD_COLORS.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: FLAVORWORLD_COLORS.textLight,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: FLAVORWORLD_COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  emptyButtonText: {
    color: FLAVORWORLD_COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  loaderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    zIndex: 1000,
  },
  loaderText: {
    marginTop: 16,
    fontSize: 16,
    color: FLAVORWORLD_COLORS.textLight,
    textAlign: 'center',
  },
});

export default HomeScreen;