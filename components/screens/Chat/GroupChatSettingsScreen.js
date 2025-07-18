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
  Switch,
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
  
  const [pendingChanges, setPendingChanges] = useState({
    name: groupChat?.name || '',
    description: groupChat?.description || '',
    image: null, 
    allowNameChange: groupChat?.settings?.allowNameChange !== false,
    allowImageChange: groupChat?.settings?.allowImageChange !== false,
    allowMemberInvites: groupChat?.settings?.allowMemberInvites === true,
  });
  
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  const [showAddMembersModal, setShowAddMembersModal] = useState(false);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [selectedNewMembers, setSelectedNewMembers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const isAdmin = chatInfo?.adminId === (currentUser?.id || currentUser?._id);

  useEffect(() => {
    loadChatInfo();
  }, []);

  useEffect(() => {
    const hasChanges = 
      pendingChanges.name !== (chatInfo?.name || '') ||
      pendingChanges.description !== (chatInfo?.description || '') ||
      pendingChanges.image !== null ||
      pendingChanges.allowNameChange !== (chatInfo?.settings?.allowNameChange !== false) ||
      pendingChanges.allowImageChange !== (chatInfo?.settings?.allowImageChange !== false) ||
      pendingChanges.allowMemberInvites !== (chatInfo?.settings?.allowMemberInvites === true);
    
    setHasUnsavedChanges(hasChanges);
  }, [pendingChanges, chatInfo]);

  const loadChatInfo = async () => {
    try {
      setLoading(true);
      const result = await chatService.getGroupChat(chatId);
      if (result.success) {
        setChatInfo(result.data);
        setPendingChanges({
          name: result.data.name,
          description: result.data.description || '',
          image: null,
          allowNameChange: result.data.settings?.allowNameChange !== false,
          allowImageChange: result.data.settings?.allowImageChange !== false,
          allowMemberInvites: result.data.settings?.allowMemberInvites === true,
        });
      }
    } catch (error) {
      console.error('Load chat info error:', error);
    } finally {
      setLoading(false);
    }
  };

  const updatePendingChange = (field, value) => {
    setPendingChanges(prev => ({
      ...prev,
      [field]: value
    }));
  };

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
        const response = await fetch(result.assets[0].uri);
        const blob = await response.blob();
        const reader = new FileReader();
        
        reader.onloadend = () => {
          const base64data = reader.result;
          updatePendingChange('image', base64data);
        };
        
        reader.readAsDataURL(blob);
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Problem selecting image');
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
          onPress: () => updatePendingChange('image', '')
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
        ...(chatInfo?.image || pendingChanges.image ? [{ 
          text: 'Remove Image', 
          style: 'destructive', 
          onPress: handleRemoveImage 
        }] : [])
      ]
    );
  };

  const handleSaveChanges = async () => {
    if (!hasUnsavedChanges) {
      Alert.alert('No Changes', 'No changes to save');
      return;
    }

    if (!pendingChanges.name.trim()) {
      Alert.alert('Error', 'Group name cannot be empty');
      return;
    }

    try {
      setUpdating(true);
      
      const updateData = {};
      
      if (pendingChanges.name !== chatInfo.name) {
        updateData.name = pendingChanges.name.trim();
      }
      
      if (pendingChanges.description !== (chatInfo.description || '')) {
        updateData.description = pendingChanges.description;
      }
      
      if (pendingChanges.image !== null) {
        updateData.image = pendingChanges.image;
      }
      
      if (isAdmin) {
        if (pendingChanges.allowNameChange !== (chatInfo.settings?.allowNameChange !== false)) {
          updateData.allowNameChange = pendingChanges.allowNameChange;
        }
        
        if (pendingChanges.allowImageChange !== (chatInfo.settings?.allowImageChange !== false)) {
          updateData.allowImageChange = pendingChanges.allowImageChange;
        }
        
        if (pendingChanges.allowMemberInvites !== (chatInfo.settings?.allowMemberInvites === true)) {
          updateData.allowMemberInvites = pendingChanges.allowMemberInvites;
        }
      }

      console.log('Saving changes:', updateData);

      const result = await chatService.updateGroupChat(chatId, updateData);

      if (result.success) {
        setChatInfo(prev => ({
          ...prev,
          name: pendingChanges.name.trim(),
          description: pendingChanges.description,
          image: pendingChanges.image !== null ? pendingChanges.image : prev.image,
          settings: {
            ...prev.settings,
            allowNameChange: pendingChanges.allowNameChange,
            allowImageChange: pendingChanges.allowImageChange,
            allowMemberInvites: pendingChanges.allowMemberInvites
          }
        }));
        
        setPendingChanges(prev => ({
          ...prev,
          image: null 
        }));
        
        Alert.alert('Success', 'Group settings saved successfully!');
      } else {
        Alert.alert('Error', result.message || 'Failed to save changes');
      }
    } catch (error) {
      console.error('Save changes error:', error);
      Alert.alert('Error', 'Problem saving changes');
    } finally {
      setUpdating(false);
    }
  };

  const handleCancelChanges = () => {
    Alert.alert(
      'Discard Changes',
      'Are you sure you want to discard all unsaved changes?',
      [
        { text: 'Keep Editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            setPendingChanges({
              name: chatInfo?.name || '',
              description: chatInfo?.description || '',
              image: null,
              allowNameChange: chatInfo?.settings?.allowNameChange !== false,
              allowImageChange: chatInfo?.settings?.allowImageChange !== false,
              allowMemberInvites: chatInfo?.settings?.allowMemberInvites === true,
            });
          }
        }
      ]
    );
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
        
        {/* כפתורי שמירה וביטול */}
        <View style={styles.headerButtons}>
          {hasUnsavedChanges && (
            <>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={handleCancelChanges}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.saveButton, updating && styles.saveButtonDisabled]}
                onPress={handleSaveChanges}
                disabled={updating}
              >
                {updating ? (
                  <ActivityIndicator size="small" color={FLAVORWORLD_COLORS.white} />
                ) : (
                  <Text style={styles.saveButtonText}>Save</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/**/}
        {hasUnsavedChanges && (
          <View style={styles.unsavedChangesNotice}>
            <Ionicons name="warning" size={16} color={FLAVORWORLD_COLORS.primary} />
            <Text style={styles.unsavedChangesText}>You have unsaved changes</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Group Information</Text>
          
          {/**/}
          <View style={styles.groupAvatarSection}>
            <View style={styles.groupAvatarContainer}>
              {pendingChanges.image ? (
                <Image 
                  source={{ uri: pendingChanges.image }} 
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
              
              {pendingChanges.image && (
                <View style={styles.imageChangeBadge}>
                  <Ionicons name="camera" size={12} color={FLAVORWORLD_COLORS.white} />
                </View>
              )}
            </View>
            
            <Text style={styles.membersCount}>
              {chatInfo?.participantsCount || chatInfo?.participants?.length || 0} members
            </Text>
            
            {(isAdmin || chatInfo?.settings?.allowImageChange !== false) && (
              <TouchableOpacity 
                style={styles.editImageButton}
                onPress={showImageOptions}
              >
                <Ionicons name="camera-outline" size={16} color={FLAVORWORLD_COLORS.primary} />
                <Text style={styles.editImageButtonText}>
                  {chatInfo?.image || pendingChanges.image ? 'Change Image' : 'Add Image'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/**/}
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Group Name</Text>
            <TextInput
              style={[
                styles.infoInput,
                pendingChanges.name !== chatInfo?.name && styles.infoInputChanged
              ]}
              value={pendingChanges.name}
              onChangeText={(value) => updatePendingChange('name', value)}
              maxLength={100}
              placeholder="Enter group name"
              placeholderTextColor={FLAVORWORLD_COLORS.textLight}
              editable={isAdmin || chatInfo?.settings?.allowNameChange !== false}
            />
          </View>

          {/**/}
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Description</Text>
            <TextInput
              style={[
                styles.infoInput,
                styles.infoTextArea,
                pendingChanges.description !== (chatInfo?.description || '') && styles.infoInputChanged
              ]}
              value={pendingChanges.description}
              onChangeText={(value) => updatePendingChange('description', value)}
              maxLength={500}
              multiline
              numberOfLines={3}
              placeholder="Enter group description"
              placeholderTextColor={FLAVORWORLD_COLORS.textLight}
              editable={isAdmin || chatInfo?.settings?.allowNameChange !== false}
            />
          </View>
        </View>

        {/**/}
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

        {/**/}
        {isAdmin && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Group Permissions</Text>
            
            <View style={styles.permissionItem}>
              <View style={styles.permissionInfo}>
                <Text style={styles.permissionTitle}>Allow members to change name</Text>
                <Text style={styles.permissionDescription}>
                  Let any member change the group name and description
                </Text>
              </View>
              <Switch
                value={pendingChanges.allowNameChange}
                onValueChange={(value) => updatePendingChange('allowNameChange', value)}
                trackColor={{ false: FLAVORWORLD_COLORS.border, true: FLAVORWORLD_COLORS.primary }}
                thumbColor={FLAVORWORLD_COLORS.white}
              />
            </View>

            <View style={styles.permissionItem}>
              <View style={styles.permissionInfo}>
                <Text style={styles.permissionTitle}>Allow members to change image</Text>
                <Text style={styles.permissionDescription}>
                  Let any member change the group profile image
                </Text>
              </View>
              <Switch
                value={pendingChanges.allowImageChange}
                onValueChange={(value) => updatePendingChange('allowImageChange', value)}
                trackColor={{ false: FLAVORWORLD_COLORS.border, true: FLAVORWORLD_COLORS.primary }}
                thumbColor={FLAVORWORLD_COLORS.white}
              />
            </View>

            <View style={styles.permissionItem}>
              <View style={styles.permissionInfo}>
                <Text style={styles.permissionTitle}>Allow member invites</Text>
                <Text style={styles.permissionDescription}>
                  Let any member add new people to the group
                </Text>
              </View>
              <Switch
                value={pendingChanges.allowMemberInvites}
                onValueChange={(value) => updatePendingChange('allowMemberInvites', value)}
                trackColor={{ false: FLAVORWORLD_COLORS.border, true: FLAVORWORLD_COLORS.primary }}
                thumbColor={FLAVORWORLD_COLORS.white}
              />
            </View>
          </View>
        )}

        {/**/}
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

      {/**/}
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
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cancelButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  cancelButtonText: {
    color: FLAVORWORLD_COLORS.textLight,
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: FLAVORWORLD_COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 60,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: FLAVORWORLD_COLORS.textLight,
  },
  saveButtonText: {
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
  unsavedChangesNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: FLAVORWORLD_COLORS.white,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginVertical: 8,
    borderLeftWidth: 4,
    borderLeftColor: FLAVORWORLD_COLORS.primary,
  },
  unsavedChangesText: {
    marginLeft: 8,
    fontSize: 14,
    color: FLAVORWORLD_COLORS.text,
    fontWeight: '500',
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
    position: 'relative',
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
  imageChangeBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: FLAVORWORLD_COLORS.primary,
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: FLAVORWORLD_COLORS.white,
  },
  membersCount: {
    fontSize: 14,
    color: FLAVORWORLD_COLORS.textLight,
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
  infoInput: {
    backgroundColor: FLAVORWORLD_COLORS.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: FLAVORWORLD_COLORS.text,
    borderWidth: 1,
    borderColor: FLAVORWORLD_COLORS.border,
  },
  infoInputChanged: {
    borderColor: FLAVORWORLD_COLORS.primary,
    backgroundColor: '#FFF8F0',
  },
  infoTextArea: {
    minHeight: 80,
    textAlignVertical: 'top',
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
  permissionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: FLAVORWORLD_COLORS.border,
  },
  permissionInfo: {
    flex: 1,
    marginRight: 16,
  },
  permissionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: FLAVORWORLD_COLORS.text,
    marginBottom: 4,
  },
  permissionDescription: {
    fontSize: 14,
    color: FLAVORWORLD_COLORS.textLight,
    lineHeight: 18,
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