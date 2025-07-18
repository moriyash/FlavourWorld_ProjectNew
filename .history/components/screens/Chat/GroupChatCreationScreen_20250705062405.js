// components/screens/chat/GroupChatCreationScreen.js
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
  KeyboardAvoidingView,
  Platform,
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

const GroupChatCreationScreen = ({ navigation }) => {
  const { currentUser } = useAuth();
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [availableUsers, setAvailableUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadAvailableUsers();
  }, []);

  const loadAvailableUsers = async () => {
    try {
      setLoading(true);
      const result = await chatService.getAvailableUsersForGroupChat();
      
      if (result.success) {
        setAvailableUsers(result.data || []);
      } else {
        Alert.alert('Error', result.message || 'Failed to load available users');
      }
    } catch (error) {
      console.error('Load available users error:', error);
      Alert.alert('Error', 'There was a problem loading available users');
    } finally {
      setLoading(false);
    }
  };

  const toggleUserSelection = (user) => {
    setSelectedUsers(prevSelected => {
      const isSelected = prevSelected.some(u => u.userId === user.userId);
      
      if (isSelected) {
        return prevSelected.filter(u => u.userId !== user.userId);
      } else {
        return [...prevSelected, user];
      }
    });
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }

    if (selectedUsers.length === 0) {
      Alert.alert('Error', 'Please select at least one participant');
      return;
    }

    setCreating(true);

    try {
      const participantIds = selectedUsers.map(user => user.userId);
      
      const result = await chatService.createGroupChat(
        groupName.trim(),
        groupDescription.trim(),
        participantIds
      );

      if (result.success) {
        Alert.alert(
          'Success',
          'Group chat created successfully!',
          [
            {
              text: 'OK',
              onPress: () => {
                // נווט לצ'אט החדש
                navigation.navigate('GroupChatConversation', {
                  chatId: result.data._id,
                  groupChat: result.data,
                });
              }
            }
          ]
        );
      } else {
        Alert.alert('Error', result.message || 'Failed to create group chat');
      }
    } catch (error) {
      console.error('Create group chat error:', error);
      Alert.alert('Error', 'There was a problem creating the group chat');
    } finally {
      setCreating(false);
    }
  };

  const filteredUsers = availableUsers.filter(user => {
    if (!searchQuery.trim()) return true;
    return user.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
           user.userEmail.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const renderUserItem = ({ item }) => {
    const isSelected = selectedUsers.some(u => u.userId === item.userId);

    return (
      <TouchableOpacity
        style={[
          styles.userItem,
          isSelected && styles.userItemSelected
        ]}
        onPress={() => toggleUserSelection(item)}
        activeOpacity={0.7}
      >
        <UserAvatar
          uri={item.userAvatar}
          name={item.userName}
          size={40}
          showOnlineStatus={false}
        />

        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.userName}</Text>
          <View style={styles.userMeta}>
            {item.isFollowing && (
              <View style={styles.metaBadge}>
                <Ionicons name="person-add" size={12} color={FLAVORWORLD_COLORS.white} />
                <Text style={styles.metaText}>Following</Text>
              </View>
            )}
            {item.hasPrivateChat && (
              <View style={[styles.metaBadge, styles.chatBadge]}>
                <Ionicons name="chatbubble" size={12} color={FLAVORWORLD_COLORS.white} />
                <Text style={styles.metaText}>Chatted</Text>
              </View>
            )}
          </View>
        </View>

        <View style={[
          styles.selectionCircle,
          isSelected && styles.selectionCircleSelected
        ]}>
          {isSelected && (
            <Ionicons name="checkmark" size={16} color={FLAVORWORLD_COLORS.white} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderSelectedUser = ({ item }) => (
    <View style={styles.selectedUserChip}>
      <UserAvatar
        uri={item.userAvatar}
        name={item.userName}
        size={32}
        showOnlineStatus={false}
      />
      <Text style={styles.selectedUserName}>{item.userName}</Text>
      <TouchableOpacity
        onPress={() => toggleUserSelection(item)}
        style={styles.removeUserButton}
      >
        <Ionicons name="close" size={16} color={FLAVORWORLD_COLORS.textLight} />
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={FLAVORWORLD_COLORS.accent} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Group Chat</Text>
          <View style={styles.headerRight} />
        </View>
        
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={FLAVORWORLD_COLORS.primary} />
          <Text style={styles.loadingText}>Loading available users...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={FLAVORWORLD_COLORS.accent} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Group Chat</Text>
          <TouchableOpacity 
            style={[
              styles.createButton,
              (!groupName.trim() || selectedUsers.length === 0 || creating) && styles.createButtonDisabled
            ]}
            onPress={handleCreateGroup}
            disabled={!groupName.trim() || selectedUsers.length === 0 || creating}
          >
            {creating ? (
              <ActivityIndicator size="small" color={FLAVORWORLD_COLORS.white} />
            ) : (
              <Text style={styles.createButtonText}>Create</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Group Info */}
        <View style={styles.groupInfoSection}>
          <Text style={styles.sectionTitle}>Group Information</Text>
          
          <View style={styles.inputContainer}>
            <Ionicons name="people" size={20} color={FLAVORWORLD_COLORS.textLight} />
            <TextInput
              style={styles.textInput}
              placeholder="Group Name (Required)"
              placeholderTextColor={FLAVORWORLD_COLORS.textLight}
              value={groupName}
              onChangeText={setGroupName}
              maxLength={100}
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="document-text" size={20} color={FLAVORWORLD_COLORS.textLight} />
            <TextInput
              style={styles.textInput}
              placeholder="Group Description (Optional)"
              placeholderTextColor={FLAVORWORLD_COLORS.textLight}
              value={groupDescription}
              onChangeText={setGroupDescription}
              maxLength={500}
              multiline
              numberOfLines={2}
            />
          </View>
        </View>

        {/* Selected Users */}
        {selectedUsers.length > 0 && (
          <View style={styles.selectedUsersSection}>
            <Text style={styles.sectionTitle}>
              Selected Participants ({selectedUsers.length})
            </Text>
            <FlatList
              data={selectedUsers}
              renderItem={renderSelectedUser}
              keyExtractor={(item) => item.userId}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.selectedUsersList}
            />
          </View>
        )}

        {/* Available Users */}
        <View style={styles.usersSection}>
          <Text style={styles.sectionTitle}>Available Users</Text>
          
          {/* Search */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={FLAVORWORLD_COLORS.textLight} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search users..."
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

          {/* Users List */}
          <FlatList
            data={filteredUsers}
            renderItem={renderUserItem}
            keyExtractor={(item) => item.userId}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyUsers}>
                <Ionicons name="people-outline" size={60} color={FLAVORWORLD_COLORS.textLight} />
                <Text style={styles.emptyUsersText}>
                  {searchQuery ? 'No users found matching your search' : 'No available users to invite'}
                </Text>
                <Text style={styles.emptyUsersSubtext}>
                  You can only invite people you follow or have chatted with before
                </Text>
              </View>
            }
          />
        </View>
      </KeyboardAvoidingView>
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
  createButton: {
    backgroundColor: FLAVORWORLD_COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  createButtonDisabled: {
    backgroundColor: FLAVORWORLD_COLORS.textLight,
  },
  createButtonText: {
    color: FLAVORWORLD_COLORS.white,
    fontSize: 16,
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
  groupInfoSection: {
    backgroundColor: FLAVORWORLD_COLORS.white,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: FLAVORWORLD_COLORS.border,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: FLAVORWORLD_COLORS.text,
    marginBottom: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: FLAVORWORLD_COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: FLAVORWORLD_COLORS.text,
    marginLeft: 12,
  },
  selectedUsersSection: {
    backgroundColor: FLAVORWORLD_COLORS.white,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: FLAVORWORLD_COLORS.border,
    maxHeight: 120,
  },
  selectedUsersList: {
    paddingHorizontal: 4,
  },
  selectedUserChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: FLAVORWORLD_COLORS.primary,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    maxWidth: 120,
  },
  selectedUserName: {
    color: FLAVORWORLD_COLORS.white,
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
    marginRight: 4,
    flex: 1,
  },
  removeUserButton: {
    padding: 2,
  },
  usersSection: {
    flex: 1,
    backgroundColor: FLAVORWORLD_COLORS.white,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: FLAVORWORLD_COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    margin: 16,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: FLAVORWORLD_COLORS.text,
    marginLeft: 8,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: FLAVORWORLD_COLORS.border,
  },
  userItemSelected: {
    backgroundColor: FLAVORWORLD_COLORS.background,
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: '500',
    color: FLAVORWORLD_COLORS.text,
    marginBottom: 4,
  },
  userMeta: {
    flexDirection: 'row',
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: FLAVORWORLD_COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 8,
  },
  chatBadge: {
    backgroundColor: FLAVORWORLD_COLORS.secondary,
  },
  metaText: {
    color: FLAVORWORLD_COLORS.white,
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  selectionCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: FLAVORWORLD_COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectionCircleSelected: {
    backgroundColor: FLAVORWORLD_COLORS.primary,
    borderColor: FLAVORWORLD_COLORS.primary,
  },
  emptyUsers: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyUsersText: {
    fontSize: 16,
    fontWeight: '600',
    color: FLAVORWORLD_COLORS.text,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyUsersSubtext: {
    fontSize: 14,
    color: FLAVORWORLD_COLORS.textLight,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default GroupChatCreationScreen;