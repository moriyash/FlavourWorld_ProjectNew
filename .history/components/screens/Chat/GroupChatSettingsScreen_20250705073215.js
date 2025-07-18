// components/screens/chat/GroupChatSettingsScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../services/AuthContext';
import UserAvatar from '../../common/UserAvatar';
import { chatService } from '../../../services/chatServices';
import * as ImagePicker from 'expo-image-picker';

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

const GroupChatSettingsScreen = ({ route, navigation }) => {
  const { currentUser } = useAuth();
  const { chatId, groupChat } = route.params;
  
  const [chatInfo, setChatInfo] = useState(groupChat);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [leaving, setLeaving] = useState(false);
  
  // Edit states
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(groupChat?.name || '');
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedDescription, setEditedDescription] = useState(groupChat?.description || '');
  
  // Modal states
  const [showAddMembersModal, setShowAddMembersModal] = useState(false);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [selectedNewMembers, setSelectedNewMembers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Image states
  const [editingImage, setEditingImage] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  const isAdmin = chatInfo?.adminId === (currentUser?.id || currentUser?._id);

  useEffect(() => {
    loadChatInfo();
  }, []);

  const loadChatInfo = async () => {
    try {
      setLoading(true);
      const result = await chatService.getGroupChat(chatId);
      if (result.success) {
        setChatInfo(result.data);
        setEditedName(result.data.name);
        setEditedDescription(result.data.description || '');
      }
    } catch (error) {
      console.error('Load chat info error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Image handling functions
  const handleImagePick = async (source) => {
    try {
      let result;
      
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Error', 'Camera permission required');
          return;
        }
        
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
      } else {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Error', 'Gallery permission required');
          return;
        }
        
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
      }

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0].uri);
        setEditingImage(false);
        
        Alert.alert('Update Group Image', 'Save this as the new group image?', [
          { text: 'Cancel', style: 'cancel', onPress: () => setSelectedImage(null) },
          { text: 'Save', onPress: handleUpdateImage }
        ]);
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Problem selecting image');
    }
  };

  const handleUpdateImage = async () => {
    if (!selectedImage) return;

    try {
      setUpdating(true);
      
      // המרה ל-base64
      const response = await fetch(selectedImage);
      const blob = await response.blob();
      const reader = new FileReader();
      
      reader.onloadend = async () => {
        const base64data = reader.result;
        
        const result = await chatService.updateGroupChat(chatId, {
          image: base64data
        });

        if (result.success) {
          setChatInfo(prev => ({ ...prev, image: base64data }));
          setSelectedImage(null);
          Alert.alert('Success', 'Group image updated successfully');
        } else {
          Alert.alert('Error', result.message || 'Failed to update group image');
        }
        
        setUpdating(false);
      };
      
      reader.readAsDataURL(blob);
      
    } catch (error) {
      console.error('Update image error:', error);
      Alert.alert('Error', 'Problem updating group image');
      setUpdating(false);
    }
  };

  const handleRemoveImage = () => {
    Alert.alert(
      'Remove Group Image',
      'Are you sure you want to remove the group image?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              setUpdating(true);
              const result = await chatService.updateGroupChat(chatId, {
                image: null
              });

              if (result.success) {
                setChatInfo(prev => ({ ...prev, image: null }));
                Alert.alert('Success', 'Group image removed successfully');
              } else {
                Alert.alert('Error', result.message || 'Failed to remove group image');
              }
            } catch (error) {
              console.error('Remove image error:', error);
              Alert.alert('Error', 'Problem removing group image');
            } finally {
              setUpdating(false);
            }
          }
        }
      ]
    );
  };

  const showImageOptions = () => {
    Alert.alert(
      'Group Image',
      'Choose an option',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Camera', onPress: () => handleImagePick('camera') },
        { text: 'Gallery', onPress: () => handleImagePick('gallery') },
        ...(chatInfo?.image ? [{ text: 'Remove Image', style: 'destructive', onPress: handleRemoveImage }] : [])
      ]
    );
  };

  const handleUpdateName = async () => {
    if (!editedName.trim()) {
      Alert.alert('Error', 'Group name cannot be empty');
      return;
    }

    if (editedName.trim() === chatInfo.name) {
      setIsEditingName(false);
      return;
    }

    try {
      setUpdating(true);
      const result = await chatService.updateGroupChat(chatId, {
        name: editedName.trim()
      });

      if (result.success) {
        setChatInfo(prev => ({ ...prev, name: editedName.trim() }));
        setIsEditingName(false);
        Alert.alert('Success', 'Group name updated successfully');
      } else {
        Alert.alert('Error', result.message || 'Failed to update group name');
      }
    } catch (error) {
      console.error('Update name error:', error);
      Alert.alert('Error', 'Problem updating group name');
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateDescription = async () => {
    if (editedDescription === (chatInfo.description || '')) {
      setIsEditingDescription(false);
      return;
    }

    try {
      setUpdating(true);
      const result = await chatService.updateGroupChat(chatId, {
        description: editedDescription
      });

      if (result.success) {
        setChatInfo(prev => ({ ...prev, description: editedDescription }));
        setIsEditingDescription(false);
        Alert.alert('Success', 'Group description updated successfully');
      } else {
        Alert.alert('Error', result.message || 'Failed to update group description');
      }
    } catch (error) {
      console.error('Update description error:', error);
      Alert.alert('Error', 'Problem updating group description');
    } finally {
      setUpdating(false);
    }
  };

  const handleRemoveMember = (member) => {
    if (member.userId === chatInfo.adminId) {
      Alert.alert('Error', 'Cannot remove the group admin');
      return;
    }

    Alert.alert(
      'Remove Member',
      `Are you sure you want to remove ${member.userName} from the group?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeMember(member.userId)
        }
      ]
    );
  };

  const removeMember = async (userId) => {
    try {
      setUpdating(true);
      const result = await chatService.removeParticipantFromGroupChat(chatId, userId);

      if (result.success) {
        setChatInfo(prev => ({
          ...prev,
          participants: prev.participants.filter(p => p.userId !== userId),
          participantsCount: (prev.participantsCount || prev.participants.length) - 1
        }));
        Alert.alert('Success', 'Member removed successfully');
      } else {
        Alert.alert('Error', result.message || 'Failed to remove member');
      }
    } catch (error) {
      console.error('Remove member error:', error);
      Alert.alert('Error', 'Problem removing member');
    } finally {
      setUpdating(false);
    }
  };

  const loadAvailableUsersForInvite = async () => {
    try {
      setLoadingUsers(true);
      const result = await chatService.getAvailableUsersForGroupChat(chatId);
      
      if (result.success) {
        setAvailableUsers(result.data || []);
      } else {
        Alert.alert('Error', result.message || 'Failed to load available users');
      }
    } catch (error) {
      console.error('Load available users error:', error);
      Alert.alert('Error', 'Problem loading available users');
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleAddMembers = () => {
    setSelectedNewMembers([]);
    setShowAddMembersModal(true);
    loadAvailableUsersForInvite();
  };

  const toggleUserSelection = (user) => {
    setSelectedNewMembers(prev => {
      const isSelected = prev.some(u => u.userId === user.userId);
      if (isSelected) {
        return prev.filter(u => u.userId !== user.userId);
      } else {
        return [...prev, user];
      }
    });
  };

  const confirmAddMembers = async () => {
    if (selectedNewMembers.length === 0) {
      Alert.alert('Error', 'Please select at least one user to add');
      return;
    }

    try {
      setUpdating(true);
      const userIds = selectedNewMembers.map(user => user.userId);
      const result = await chatService.addParticipantsToGroupChat(chatId, userIds);

      if (result.success) {
        loadChatInfo();
        setShowAddMembersModal(false);
        Alert.alert('Success', `Added ${selectedNewMembers.length} member(s) successfully`);
      } else {
        Alert.alert('Error', result.message || 'Failed to add members');
      }
    } catch (error) {
      console.error('Add members error:', error);
      Alert.alert('Error', 'Problem adding members');
    } finally {
      setUpdating(false);
    }
  };

  const handleLeaveGroup = () => {
    Alert.alert(
      'Leave Group',
      isAdmin 
        ? 'As the admin, if you leave, another member will randomly become the new admin. Are you sure you want to leave?'
        : 'Are you sure you want to leave this group?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: leaveGroup
        }
      ]
    );
  };

  const leaveGroup = async () => {
    try {
      setLeaving(true);
      const result = await chatService.leaveGroupChat(chatId);

      if (result.success) {
        Alert.alert(
          'Left Group',
          'You have left the group successfully',
          [
            {
              text: 'OK',
              onPress: () => {
                navigation.popToTop();
              }
            }
          ]
        );
      } else {
        Alert.alert('Error', result.message || 'Failed to leave group');
      }
    } catch (error) {
      console.error('Leave group error:', error);
      Alert.alert('Error', 'Problem leaving group');
    } finally {
      setLeaving(false);
    }
  };

  const renderMember = ({ item }) => {
    const isCurrentUser = item.userId === (currentUser?.id || currentUser?._id);
    const isMemberAdmin = item.userId === chatInfo.adminId;
    
    return (
      <View style={styles.memberItem}>
        <UserAvatar
          uri={item.userAvatar}
          name={item.userName}
          size={40}
          showOnlineStatus={false}
        />
        
        <View style={styles.memberInfo}>
          <View style={styles.memberHeader}>
            <Text style={styles.memberName}>{item.userName}</Text>
            {isMemberAdmin && (
              <View style={styles.adminBadge}>
                <Ionicons name="star" size={12} color={FLAVORWORLD_COLORS.white} />
                <Text style={styles.adminText}>Admin</Text>
              </View>
            )}
            {isCurrentUser && (
              <View style={styles.youBadge}>
                <Text style={styles.youText}>You</Text>
              </View>
            )}
          </View>
          <Text style={styles.memberRole}>
            Joined {new Date(item.joinedAt).toLocaleDateString()}
          </Text>
        </View>
        
        {isAdmin && !isCurrentUser && !isMemberAdmin && (
          <TouchableOpacity
            style={styles.removeMemberButton}
            onPress={() => handleRemoveMember(item)}
          >
            <Ionicons name="person-remove" size={20} color={FLAVORWORLD_COLORS.danger} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderAvailableUser = ({ item }) => {
    const isSelected = selectedNewMembers.some(u => u.userId === item.userId);

    return (
      <TouchableOpacity
        style={[styles.availableUserItem, isSelected && styles.selectedUserItem]}
        onPress={() => toggleUserSelection(item)}
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
                <Text style={styles.metaText}>Following</Text>
              </View>
            )}
            {item.hasPrivateChat && (
              <View style={[styles.metaBadge, styles.chatBadge]}>
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
          <Text style={styles.headerTitle}>Group Settings</Text>
          <View style={styles.headerRight} />
        </View>
        
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={FLAVORWORLD_COLORS.primary} />
          <Text style={styles.loadingText}>Loading group settings...</Text>
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
        <Text style={styles.headerTitle}>Group Settings</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Group Information</Text>
          
          {/* Updated Group Avatar Section */}
          <View style={styles.groupAvatarSection}>
            <View style={styles.groupAvatarContainer}>
              {selectedImage ? (
                <Image 
                  source={{ uri: selectedImage }} 
                  style={styles.groupAvatarPreview}
                />
              ) : chatInfo?.image ? (
                <UserAvatar
                  uri={chatInfo.image}
                  name={chatInfo.name}
                  size={80}
                  showOnlineStatus={false}
                />
              ) : (
                <View style={styles.defaultGroupAvatar}>
                  <Ionicons name="people" size={40} color={FLAVORWORLD_COLORS.white} />
                </View>
              )}
            </View>
            
            <Text style={styles.membersCount}>
              {chatInfo?.participantsCount || chatInfo?.participants?.length || 0} members
            </Text>
            
            {/* Edit Image Button - Only for Admin */}
            {isAdmin && (
              <TouchableOpacity 
                style={styles.editImageButton}
                onPress={showImageOptions}
              >
                <Ionicons name="camera-outline" size={16} color={FLAVORWORLD_COLORS.primary} />
                <Text style={styles.editImageButtonText}>
                  {chatInfo?.image ? 'Change Image' : 'Add Image'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Group Name */}
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Group Name</Text>
            {isEditingName ? (
              <View style={styles.editContainer}>
                <TextInput
                  style={styles.editInput}
                  value={editedName}
                  onChangeText={setEditedName}
                  maxLength={100}
                  autoFocus
                />
                <View style={styles.editActions}>
                  <TouchableOpacity
                    style={styles.editCancelButton}
                    onPress={() => {
                      setEditedName(chatInfo.name);
                      setIsEditingName(false);
                    }}
                  >
                    <Text style={styles.editCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.editSaveButton}
                    onPress={handleUpdateName}
                    disabled={updating}
                  >
                    {updating ? (
                      <ActivityIndicator size="small" color={FLAVORWORLD_COLORS.white} />
                    ) : (
                      <Text style={styles.editSaveText}>Save</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.editableInfo}
                onPress={() => setIsEditingName(true)}
              >
                <Text style={styles.infoValue}>{chatInfo?.name}</Text>
                <Ionicons name="create-outline" size={20} color={FLAVORWORLD_COLORS.textLight} />
              </TouchableOpacity>
            )}
          </View>

          {/* Group Description */}
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Description</Text>
            {isEditingDescription ? (
              <View style={styles.editContainer}>
                <TextInput
                  style={[styles.editInput, styles.editTextArea]}
                  value={editedDescription}
                  onChangeText={setEditedDescription}
                  maxLength={500}
                  multiline
                  numberOfLines={3}
                  autoFocus
                />
                <View style={styles.editActions}>
                  <TouchableOpacity
                    style={styles.editCancelButton}
                    onPress={() => {
                      setEditedDescription(chatInfo.description || '');
                      setIsEditingDescription(false);
                    }}
                  >
                    <Text style={styles.editCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.editSaveButton}
                    onPress={handleUpdateDescription}
                    disabled={updating}
                  >
                    {updating ? (
                      <ActivityIndicator size="small" color={FLAVORWORLD_COLORS.white} />
                    ) : (
                      <Text style={styles.editSaveText}>Save</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.editableInfo}
                onPress={() => setIsEditingDescription(true)}
              >
                <Text style={styles.infoValue}>
                  {chatInfo?.description || 'No description'}
                </Text>
                <Ionicons name="create-outline" size={20} color={FLAVORWORLD_COLORS.textLight} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Members Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Members ({chatInfo?.participants?.length || 0})
            </Text>
            {isAdmin && (
              <TouchableOpacity
                style={styles.addMembersButton}
                onPress={handleAddMembers}
              >
                <Ionicons name="person-add" size={20} color={FLAVORWORLD_COLORS.primary} />
                <Text style={styles.addMembersText}>Add</Text>
              </TouchableOpacity>
            )}
          </View>

          <FlatList
            data={chatInfo?.participants || []}
            renderItem={renderMember}
            keyExtractor={(item) => item.userId}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={styles.memberSeparator} />}
          />
        </View>

        {/* Actions Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>
          
          <TouchableOpacity
            style={[styles.actionButton, styles.leaveButton]}
            onPress={handleLeaveGroup}
            disabled={leaving}
          >
            {leaving ? (
              <ActivityIndicator size="small" color={FLAVORWORLD_COLORS.white} />
            ) : (
              <>
                <Ionicons name="exit-outline" size={20} color={FLAVORWORLD_COLORS.white} />
                <Text style={styles.leaveButtonText}>Leave Group</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Add Members Modal */}
      <Modal
        visible={showAddMembersModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setShowAddMembersModal(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add Members</Text>
            <TouchableOpacity
              onPress={confirmAddMembers}
              disabled={selectedNewMembers.length === 0 || updating}
            >
              {updating ? (
                <ActivityIndicator size="small" color={FLAVORWORLD_COLORS.primary} />
              ) : (
                <Text style={[
                  styles.modalDoneText,
                  selectedNewMembers.length === 0 && styles.modalDoneTextDisabled
                ]}>
                  Add ({selectedNewMembers.length})
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {loadingUsers ? (
            <View style={styles.modalLoadingContainer}>
              <ActivityIndicator size="large" color={FLAVORWORLD_COLORS.primary} />
              <Text style={styles.modalLoadingText}>Loading available users...</Text>
            </View>
          ) : (
            <FlatList
              data={availableUsers}
              renderItem={renderAvailableUser}
              keyExtractor={(item) => item.userId}
              style={styles.modalContent}
              ListEmptyComponent={
                <View style={styles.emptyUsers}>
                  <Ionicons name="people-outline" size={60} color={FLAVORWORLD_COLORS.textLight} />
                  <Text style={styles.emptyUsersText}>No users available to add</Text>
                  <Text style={styles.emptyUsersSubtext}>
                    You can only add people you follow or have chatted with
                  </Text>
                </View>
              }
            />
          )}
        </SafeAreaView>
      </Modal>
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
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: FLAVORWORLD_COLORS.white,
    marginVertical: 8,
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: FLAVORWORLD_COLORS.text,
  },
  addMembersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: FLAVORWORLD_COLORS.background,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  addMembersText: {
    color: FLAVORWORLD_COLORS.primary,
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  groupAvatarSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  groupAvatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
    marginBottom: 8,
  },
  groupAvatarPreview: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  defaultGroupAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: FLAVORWORLD_COLORS.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  membersCount: {
    fontSize: 14,
    color: FLAVORWORLD_COLORS.textLight,
  },
  editImageHint: {
    fontSize: 12,
    color: FLAVORWORLD_COLORS.textLight,
    marginTop: 4,
    textAlign: 'center',
  },
  editImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: FLAVORWORLD_COLORS.background,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 8,
    borderWidth: 1,
    borderColor: FLAVORWORLD_COLORS.border,
  },
  editImageButtonText: {
    color: FLAVORWORLD_COLORS.primary,
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  infoItem: {
    marginBottom: 20,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: FLAVORWORLD_COLORS.textLight,
    marginBottom: 8,
  },
  editableInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: FLAVORWORLD_COLORS.background,
    padding: 12,
    borderRadius: 8,
  },
  infoValue: {
    fontSize: 16,
    color: FLAVORWORLD_COLORS.text,
    flex: 1,
  },
  editContainer: {
    backgroundColor: FLAVORWORLD_COLORS.background,
    padding: 12,
    borderRadius: 8,
  },
  editInput: {
    fontSize: 16,
    color: FLAVORWORLD_COLORS.text,
    borderBottomWidth: 1,
    borderBottomColor: FLAVORWORLD_COLORS.border,
    paddingVertical: 8,
    marginBottom: 12,
  },
  editTextArea: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  editCancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
  },
  editCancelText: {
    color: FLAVORWORLD_COLORS.textLight,
    fontSize: 16,
  },
  editSaveButton: {
    backgroundColor: FLAVORWORLD_COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  editSaveText: {
    color: FLAVORWORLD_COLORS.white,
    fontSize: 16,
    fontWeight: '500',
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  memberInfo: {
    flex: 1,
    marginLeft: 12,
  },
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '500',
    color: FLAVORWORLD_COLORS.text,
    marginRight: 8,
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: FLAVORWORLD_COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 8,
  },
  adminText: {
    color: FLAVORWORLD_COLORS.white,
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 2,
  },
  youBadge: {
    backgroundColor: FLAVORWORLD_COLORS.secondary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  youText: {
    color: FLAVORWORLD_COLORS.white,
    fontSize: 12,
    fontWeight: '500',
  },
  memberRole: {
    fontSize: 12,
    color: FLAVORWORLD_COLORS.textLight,
  },
  removeMemberButton: {
    padding: 8,
  },
  memberSeparator: {
    height: 1,
    backgroundColor: FLAVORWORLD_COLORS.border,
    marginVertical: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  leaveButton: {
    backgroundColor: FLAVORWORLD_COLORS.danger,
  },
  leaveButtonText: {
    color: FLAVORWORLD_COLORS.white,
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: FLAVORWORLD_COLORS.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: FLAVORWORLD_COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: FLAVORWORLD_COLORS.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: FLAVORWORLD_COLORS.text,
  },
  modalCancelText: {
    fontSize: 16,
    color: FLAVORWORLD_COLORS.textLight,
  },
  modalDoneText: {
    fontSize: 16,
    color: FLAVORWORLD_COLORS.primary,
    fontWeight: '500',
  },
  modalDoneTextDisabled: {
    color: FLAVORWORLD_COLORS.textLight,
  },
  modalContent: {
    flex: 1,
    backgroundColor: FLAVORWORLD_COLORS.white,
  },
  modalLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalLoadingText: {
    marginTop: 16,
    fontSize: 16,
    color: FLAVORWORLD_COLORS.textLight,
  },
  availableUserItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: FLAVORWORLD_COLORS.border,
  },
  selectedUserItem: {
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
    backgroundColor: FLAVORWORLD_COLORS.primary,
    borderRadius: 8,
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

export default GroupChatSettingsScreen;