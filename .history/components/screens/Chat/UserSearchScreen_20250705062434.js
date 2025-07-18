// components/screens/chat/UserSearchScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
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

const UserSearchScreen = ({ route, navigation }) => {
  const { currentUser } = useAuth();
  const { purpose = 'chat', title = 'Search Users' } = route.params || {};
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState(null);

  useEffect(() => {
    if (searchQuery.trim().length >= 2) {
      // Debounce search
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
      
      const timeout = setTimeout(() => {
        performSearch(searchQuery);
      }, 500);
      
      setSearchTimeout(timeout);
    } else {
      setSearchResults([]);
    }

    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [searchQuery]);

  const performSearch = async (query) => {
    try {
      setLoading(true);
      const result = await chatService.searchUsers(query);
      
      if (result.success) {
        setSearchResults(result.data || []);
      } else {
        console.error('Search error:', result.message);
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Search users error:', error);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUserPress = async (user) => {
    if (purpose === 'chat') {
      await startPrivateChat(user);
    } else {
      // For other purposes (like following), just go back with the user
      navigation.navigate(route.params.returnScreen || 'ChatList', { selectedUser: user });
    }
  };

  const startPrivateChat = async (user) => {
    try {
      setCreating(true);
      
      // Create or get existing private chat
      const result = await chatService.getOrCreatePrivateChat(user.userId);
      
      if (result.success) {
        // Navigate to the chat conversation
        const otherUser = {
          userId: user.userId,
          userName: user.userName,
          userAvatar: user.userAvatar,
        };
        
        navigation.navigate('ChatConversation', {
          chatId: result.data._id,
          otherUser: otherUser,
        });
      } else {
        Alert.alert('Error', result.message || 'Failed to create chat');
      }
    } catch (error) {
      console.error('Create private chat error:', error);
      Alert.alert('Error', 'Problem creating chat');
    } finally {
      setCreating(false);
    }
  };

  const renderUserItem = ({ item }) => (
    <TouchableOpacity
      style={styles.userItem}
      onPress={() => handleUserPress(item)}
      activeOpacity={0.7}
      disabled={creating}
    >
      <UserAvatar
        uri={item.userAvatar}
        name={item.userName}
        size={50}
        showOnlineStatus={false}
      />

      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.userName}</Text>
        <Text style={styles.userEmail}>{item.userEmail}</Text>
        {item.userBio && (
          <Text style={styles.userBio} numberOfLines={1}>
            {item.userBio}
          </Text>
        )}
      </View>

      <TouchableOpacity style={styles.actionButton}>
        <Ionicons 
          name={purpose === 'chat' ? 'chatbubble' : 'person-add'} 
          size={20} 
          color={FLAVORWORLD_COLORS.primary} 
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderEmptyState = () => {
    if (searchQuery.trim().length === 0) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="search-outline" size={80} color={FLAVORWORLD_COLORS.textLight} />
          <Text style={styles.emptyTitle}>Search for Users</Text>
          <Text style={styles.emptySubtitle}>
            Type at least 2 characters to start searching for users
          </Text>
        </View>
      );
    }

    if (searchQuery.trim().length >= 2 && !loading && searchResults.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="person-outline" size={80} color={FLAVORWORLD_COLORS.textLight} />
          <Text style={styles.emptyTitle}>No Users Found</Text>
          <Text style={styles.emptySubtitle}>
            No users found matching "{searchQuery}"
          </Text>
        </View>
      );
    }

    return null;
  };

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
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={FLAVORWORLD_COLORS.textLight} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or email..."
            placeholderTextColor={FLAVORWORLD_COLORS.textLight}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close" size={20} color={FLAVORWORLD_COLORS.textLight} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Results */}
      <View style={styles.content}>
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={FLAVORWORLD_COLORS.primary} />
            <Text style={styles.loadingText}>Searching users...</Text>
          </View>
        )}

        <FlatList
          data={searchResults}
          renderItem={renderUserItem}
          keyExtractor={(item) => item.userId}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={searchResults.length === 0 ? styles.emptyList : null}
        />
      </View>

      {/* Creating Chat Overlay */}
      {creating && (
        <View style={styles.creatingOverlay}>
          <View style={styles.creatingModal}>
            <ActivityIndicator size="large" color={FLAVORWORLD_COLORS.primary} />
            <Text style={styles.creatingText}>Creating chat...</Text>
          </View>
        </View>
      )}
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
    marginHorizontal: 16,
  },
  headerRight: {
    width: 40,
  },
  searchContainer: {
    backgroundColor: FLAVORWORLD_COLORS.white,
    paddingHorizontal: 16,
    paddingVertical: 16,
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
  content: {
    flex: 1,
    backgroundColor: FLAVORWORLD_COLORS.white,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: FLAVORWORLD_COLORS.textLight,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: FLAVORWORLD_COLORS.border,
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: FLAVORWORLD_COLORS.text,
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 14,
    color: FLAVORWORLD_COLORS.textLight,
    marginBottom: 2,
  },
  userBio: {
    fontSize: 14,
    color: FLAVORWORLD_COLORS.text,
    fontStyle: 'italic',
  },
  actionButton: {
    padding: 12,
    backgroundColor: FLAVORWORLD_COLORS.background,
    borderRadius: 20,
  },
  emptyList: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
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
  },
  creatingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  creatingModal: {
    backgroundColor: FLAVORWORLD_COLORS.white,
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
  },
  creatingText: {
    marginTop: 16,
    fontSize: 16,
    color: FLAVORWORLD_COLORS.text,
    fontWeight: '500',
  },
});

export default UserSearchScreen;