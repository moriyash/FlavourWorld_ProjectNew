// components/screens/chat/ChatListScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../services/AuthContext';
import UserAvatar from '../../common/UserAvatar';
import { chatService } from '../../../services/chatServices';

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
};

const ChatListScreen = ({ navigation }) => {
  const { currentUser } = useAuth();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadChats();
    initializeSocket();
    
    return () => {
      chatService.disconnect();
    };
  }, []);

  const initializeSocket = async () => {
    if (currentUser?.id || currentUser?._id) {
      await chatService.initializeSocket(currentUser.id || currentUser._id);
      
      // האזנה להודעות חדשות לעדכון הרשימה
      const unsubscribe = chatService.onMessage((message) => {
        updateChatWithNewMessage(message);
      });
      
      return unsubscribe;
    }
  };

  const loadChats = async () => {
    try {
      setLoading(true);
      const result = await chatService.getMyChats();
      
      if (result.success) {
        setChats(result.data || []);
      } else {
        Alert.alert('Error', result.message || 'Failed to load chats');
      }
    } catch (error) {
      console.error('Load chats error:', error);
      Alert.alert('Error', 'There was a problem loading the chats');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const updateChatWithNewMessage = (message) => {
    setChats(prevChats => {
      return prevChats.map(chat => {
        if (chat._id === message.chatId) {
          return {
            ...chat,
            lastMessage: message,
            unreadCount: chat.unreadCount + 1,
            updatedAt: message.createdAt
          };
        }
        return chat;
      }).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    });
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadChats();
  }, []);

  const formatTime = (dateString) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));
    
    if (diffInHours < 1) {
      return 'now';
    } else if (diffInHours < 24) {
      return `${diffInHours}h`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      if (diffInDays === 1) return 'yesterday';
      if (diffInDays < 7) return `${diffInDays}d`;
      return date.toLocaleDateString('en-US');
    }
  };

  const getOtherUser = (chat) => {
    if (!chat.participants || chat.participants.length < 2) return null;
    
    const otherUser = chat.participants.find(p => 
      p.userId !== (currentUser?.id || currentUser?._id)
    );
    
    return otherUser || null;
  };

  const handleChatPress = (chat) => {
    const otherUser = getOtherUser(chat);
    if (otherUser) {
      navigation.navigate('ChatConversation', {
        chatId: chat._id,
        otherUser: otherUser,
      });
    }
  };

  const filteredChats = chats.filter(chat => {
    if (!searchQuery.trim()) return true;
    
    const otherUser = getOtherUser(chat);
    if (!otherUser) return false;
    
    return otherUser.userName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const renderChatItem = ({ item }) => {
    const otherUser = getOtherUser(item);
    if (!otherUser) return null;

    const hasUnread = item.unreadCount > 0;
    const lastMessage = item.lastMessage;

    return (
      <TouchableOpacity
        style={styles.chatItem}
        onPress={() => handleChatPress(item)}
        activeOpacity={0.7}
      >
        <UserAvatar
          uri={otherUser.userAvatar}
          name={otherUser.userName}
          size={50}
          showOnlineStatus={true}
          isOnline={otherUser.isOnline}
        />

        <View style={styles.chatInfo}>
          <View style={styles.chatHeader}>
            <Text style={[
              styles.chatName,
              hasUnread && styles.chatNameUnread
            ]}>
              {otherUser.userName}
            </Text>
            <Text style={styles.chatTime}>
              {formatTime(item.updatedAt)}
            </Text>
          </View>

          <View style={styles.chatMessageRow}>
            <Text
              style={[
                styles.lastMessage,
                hasUnread && styles.lastMessageUnread
              ]}
              numberOfLines={1}
            >
              {lastMessage ? lastMessage.content : 'Start a conversation...'}
            </Text>
            
            {hasUnread && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>
                  {item.unreadCount > 99 ? '99+' : item.unreadCount}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="chatbubbles-outline" size={80} color={FLAVORWORLD_COLORS.textLight} />
      <Text style={styles.emptyTitle}>No Chats Yet</Text>
      <Text style={styles.emptySubtitle}>
        Start a conversation with your cooking community friends!
      </Text>
      <TouchableOpacity 
        style={styles.startChatButton}
        onPress={() => navigation.goBack()}
      >
        <Ionicons name="arrow-back" size={16} color={FLAVORWORLD_COLORS.white} />
        <Text style={styles.startChatButtonText}>Back to Home</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={FLAVORWORLD_COLORS.accent} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Chats</Text>
          <View style={styles.headerRight} />
        </View>
        
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={FLAVORWORLD_COLORS.primary} />
          <Text style={styles.loadingText}>Loading chats...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={FLAVORWORLD_COLORS.accent} />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Chats</Text>
        
        <View style={styles.headerRight}>
          <Text style={styles.chatCount}>{chats.length}</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={FLAVORWORLD_COLORS.textLight} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search Chats"
            placeholderTextColor={FLAVORWORLD_COLORS.textLight}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close" size={20} color={FLAVORWORLD_COLORS.textLight} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Chat List */}
      <FlatList
        data={filteredChats}
        keyExtractor={(item) => item._id}
        renderItem={renderChatItem}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[FLAVORWORLD_COLORS.primary]}
            tintColor={FLAVORWORLD_COLORS.primary}
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={filteredChats.length === 0 ? styles.emptyList : null}
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
  },
  headerRight: {
    width: 40,
    alignItems: 'center',
  },
  chatCount: {
    fontSize: 12,
    color: FLAVORWORLD_COLORS.textLight,
    fontWeight: '500',
  },
  searchContainer: {
    backgroundColor: FLAVORWORLD_COLORS.white,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: FLAVORWORLD_COLORS.border,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: FLAVORWORLD_COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: FLAVORWORLD_COLORS.text,
    marginLeft: 8,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: FLAVORWORLD_COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: FLAVORWORLD_COLORS.border,
  },
  chatInfo: {
    flex: 1,
    marginLeft: 12,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '500',
    color: FLAVORWORLD_COLORS.text,
  },
  chatNameUnread: {
    fontWeight: '600',
  },
  chatTime: {
    fontSize: 12,
    color: FLAVORWORLD_COLORS.textLight,
  },
  chatMessageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    flex: 1,
    fontSize: 14,
    color: FLAVORWORLD_COLORS.textLight,
    marginRight: 8,
  },
  lastMessageUnread: {
    color: FLAVORWORLD_COLORS.text,
    fontWeight: '500',
  },
  unreadBadge: {
    backgroundColor: FLAVORWORLD_COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  unreadText: {
    color: FLAVORWORLD_COLORS.white,
    fontSize: 12,
    fontWeight: '600',
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
  emptyList: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: FLAVORWORLD_COLORS.text,
    marginTop: 16,
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
  startChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: FLAVORWORLD_COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
  },
  startChatButtonText: {
    color: FLAVORWORLD_COLORS.white,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default ChatListScreen;
