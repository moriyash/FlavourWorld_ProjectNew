// components/screens/notifications/NotificationsScreen.js - גרסה מעודכנת

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../services/AuthContext';
import { notificationService } from '../../../services/NotificationService';
import UserAvatar from '../../common/UserAvatar';

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

const NotificationsScreen = ({ navigation }) => {
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const userId = currentUser?.id || currentUser?._id;
      
      if (!userId) {
        console.error('No user ID available');
        setLoading(false);
        return;
      }

      const result = await notificationService.getUserNotifications(userId);
      
      if (result.success) {
        setNotifications(result.data || []);
        const unread = (result.data || []).filter(n => !n.read).length;
        setUnreadCount(unread);
      } else {
        console.error('Failed to load notifications:', result.message);
        Alert.alert('Error', result.message || 'Failed to load notifications');
      }
    } catch (error) {
      console.error('Load notifications error:', error);
      Alert.alert('Error', 'Failed to load notifications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUser]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadNotifications();
  }, [loadNotifications]);

  const handleMarkAsRead = useCallback(async (notificationId) => {
    try {
      const result = await notificationService.markAsRead(notificationId);
      if (result.success) {
        setNotifications(prev => 
          prev.map(n => 
            n._id === notificationId ? { ...n, read: true } : n
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Mark as read error:', error);
    }
  }, []);

  const handleMarkAllAsRead = useCallback(async () => {
    try {
      const userId = currentUser?.id || currentUser?._id;
      if (!userId) return;

      const result = await notificationService.markAllAsRead(userId);
      if (result.success) {
        setNotifications(prev => 
          prev.map(n => ({ ...n, read: true }))
        );
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Mark all as read error:', error);
    }
  }, [currentUser]);

  const handleNotificationPress = useCallback(async (notification) => {
    // סמן כנקרא אם עדיין לא נקרא
    if (!notification.read) {
      await handleMarkAsRead(notification._id);
    }

    // נווט למקום המתאים בהתאם לסוג ההתראה
    switch (notification.type) {
      case 'like':
      case 'comment':
        if (notification.postId) {
          // בדוק אם זה פוסט קבוצה או רגיל
          if (notification.groupId) {
            navigation.navigate('GroupDetails', { 
              groupId: notification.groupId,
              // יכול להוסיף פה focus על הפוסט הספציפי
            });
          } else {
            // נווט לפוסט רגיל - תצטרך ליצור מסך PostDetails
            // navigation.navigate('PostDetails', { postId: notification.postId });
            // כרגע נחזור להום
            navigation.navigate('Home');
          }
        }
        break;
      
      case 'follow':
        if (notification.fromUserId) {
          navigation.navigate('Profile', { userId: notification.fromUserId });
        }
        break;
      
      case 'group_post':
      case 'group_join_request':
      case 'group_request_approved':
        if (notification.groupId) {
          navigation.navigate('GroupDetails', { groupId: notification.groupId });
        }
        break;
      
      default:
        console.log('Unknown notification type:', notification.type);
        break;
    }
  }, [handleMarkAsRead, navigation]);

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'like':
        return { name: 'heart', color: FLAVORWORLD_COLORS.danger };
      case 'comment':
        return { name: 'chatbubble-outline', color: FLAVORWORLD_COLORS.info };
      case 'follow':
        return { name: 'person-add-outline', color: FLAVORWORLD_COLORS.success };
      case 'group_post':
        return { name: 'restaurant-outline', color: FLAVORWORLD_COLORS.primary };
      case 'group_join_request':
        return { name: 'people-outline', color: FLAVORWORLD_COLORS.secondary };
      case 'group_request_approved':
        return { name: 'checkmark-circle-outline', color: FLAVORWORLD_COLORS.success };
      default:
        return { name: 'notifications-outline', color: FLAVORWORLD_COLORS.textLight };
    }
  };

  const getTimeAgo = (createdAt) => {
    const now = new Date();
    const notificationTime = new Date(createdAt);
    const diffInMs = now - notificationTime;
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    return notificationTime.toLocaleDateString();
  };

  const renderNotification = useCallback(({ item, index }) => {
    const icon = getNotificationIcon(item.type);
    const isUnread = !item.read;

    return (
      <TouchableOpacity
        style={[
          styles.notificationItem,
          isUnread && styles.unreadNotification
        ]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.notificationContent}>
          {/* אווטר של המשתמש */}
          <View style={styles.avatarContainer}>
            <UserAvatar
              uri={item.fromUser?.avatar}
              name={item.fromUser?.name || 'User'}
              size={40}
            />
            {/* אייקון סוג ההתראה */}
            <View style={[styles.notificationIconBadge, { backgroundColor: icon.color }]}>
              <Ionicons name={icon.name} size={12} color={FLAVORWORLD_COLORS.white} />
            </View>
          </View>

          {/* תוכן ההתראה */}
          <View style={styles.notificationTextContainer}>
            <Text style={[
              styles.notificationMessage,
              isUnread && styles.unreadText
            ]}>
              {item.message}
            </Text>
            
            <Text style={styles.notificationTime}>
              {getTimeAgo(item.createdAt)}
            </Text>

            {/* תמונה קטנה אם זה קשור לפוסט */}
            {(item.type === 'like' || item.type === 'comment' || item.type === 'group_post') && item.postImage && (
              <Image source={{ uri: item.postImage }} style={styles.postThumbnail} />
            )}
          </View>

          {/* נקודה כחולה להתראות שלא נקראו */}
          {isUnread && <View style={styles.unreadDot} />}
        </View>
      </TouchableOpacity>
    );
  }, [handleNotificationPress]);

  const renderEmptyComponent = useCallback(() => (
    !loading && (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIcon}>
          <Ionicons name="notifications-outline" size={80} color={FLAVORWORLD_COLORS.textLight} />
        </View>
        <Text style={styles.emptyTitle}>No Notifications Yet</Text>
        <Text style={styles.emptySubtitle}>
          When someone likes your recipes, follows you, or there's activity in your groups, you'll see it here!
        </Text>
        <TouchableOpacity 
          style={styles.emptyButton}
          onPress={() => navigation.navigate('Home')}
        >
          <Text style={styles.emptyButtonText}>Share a Recipe</Text>
        </TouchableOpacity>
      </View>
    )
  ), [loading, navigation]);

  if (loading && notifications.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={FLAVORWORLD_COLORS.white} />
        
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={FLAVORWORLD_COLORS.accent} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
          <View style={styles.headerPlaceholder} />
        </View>

        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={FLAVORWORLD_COLORS.primary} />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={FLAVORWORLD_COLORS.white} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={FLAVORWORLD_COLORS.accent} />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>
          Notifications {unreadCount > 0 && `(${unreadCount})`}
        </Text>
        
        {unreadCount > 0 && (
          <TouchableOpacity 
            style={styles.markAllButton}
            onPress={handleMarkAllAsRead}
          >
            <Text style={styles.markAllText}>Mark All Read</Text>
          </TouchableOpacity>
        )}
        
        {unreadCount === 0 && <View style={styles.headerPlaceholder} />}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item._id || item.id || Math.random().toString()}
        renderItem={renderNotification}
        ListEmptyComponent={renderEmptyComponent}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={[FLAVORWORLD_COLORS.primary]}
            tintColor={FLAVORWORLD_COLORS.primary}
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={notifications.length === 0 ? styles.emptyList : null}
      />
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
    marginHorizontal: 16,
  },
  markAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: FLAVORWORLD_COLORS.primary,
    borderRadius: 15,
  },
  markAllText: {
    color: FLAVORWORLD_COLORS.white,
    fontSize: 12,
    fontWeight: '600',
  },
  headerPlaceholder: {
    width: 80,
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
  notificationItem: {
    backgroundColor: FLAVORWORLD_COLORS.white,
    marginBottom: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  unreadNotification: {
    backgroundColor: '#F8F9FF',
    borderLeftWidth: 3,
    borderLeftColor: FLAVORWORLD_COLORS.primary,
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  notificationIconBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: FLAVORWORLD_COLORS.white,
  },
  notificationTextContainer: {
    flex: 1,
    marginRight: 8,
  },
  notificationMessage: {
    fontSize: 14,
    color: FLAVORWORLD_COLORS.text,
    lineHeight: 20,
    marginBottom: 4,
  },
  unreadText: {
    fontWeight: '600',
  },
  notificationTime: {
    fontSize: 12,
    color: FLAVORWORLD_COLORS.textLight,
    marginBottom: 8,
  },
  postThumbnail: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginTop: 4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: FLAVORWORLD_COLORS.primary,
    marginTop: 6,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyList: {
    flex: 1,
  },
  emptyIcon: {
    marginBottom: 20,
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: FLAVORWORLD_COLORS.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: FLAVORWORLD_COLORS.textLight,
    textAlign: 'center',
    lineHeight: 22,
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
});

export default NotificationsScreen;