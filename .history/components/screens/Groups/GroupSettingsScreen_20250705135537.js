import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
  Image,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../../services/AuthContext';
import { groupService } from '../../../services/GroupService';

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

const CATEGORIES = [
  'General', 'Italian', 'Asian', 'Mediterranean', 'Mexican', 
  'Indian', 'French', 'American', 'Vegetarian', 'Vegan', 
  'Desserts', 'Baking', 'Healthy', 'Quick Meals', 'Other'
];

const GroupSettingsScreen = ({ route, navigation }) => {
  const { currentUser } = useAuth();
  const { groupId, groupData } = route.params;
  
  // State for form data
  const [formData, setFormData] = useState({
    name: groupData?.name || '',
    description: groupData?.description || '',
    category: groupData?.category || 'General',
    rules: groupData?.rules || '',
    isPrivate: groupData?.isPrivate || false,
    allowMemberPosts: groupData?.settings?.allowMemberPosts ?? groupData?.allowMemberPosts ?? true,
    requireApproval: groupData?.settings?.requireApproval ?? groupData?.requireApproval ?? false,
    allowInvites: groupData?.settings?.allowInvites ?? groupData?.allowInvites ?? true,
  });
  
  const [selectedImage, setSelectedImage] = useState(groupData?.image || null);
  const [loading, setLoading] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Check permissions
  const isCreator = groupService.isCreator(groupData, currentUser?.id || currentUser?._id);
  const isAdmin = groupService.isAdmin(groupData, currentUser?.id || currentUser?._id);
  const isMember = groupService.isMember(groupData, currentUser?.id || currentUser?._id);
  
  // כל חבר יכול לערוך פרופיל (כולל יוצר ואדמינים), רק אדמינים יכולים לערוך הגדרות
  const canEditProfile = isMember || isAdmin || isCreator; // כל מי שקשור לקבוצה
  const canEditSettings = isCreator || isAdmin; // רק אדמינים

  useEffect(() => {
    if (!canEditProfile) {
      Alert.alert('Access Denied', 'Only group members can access group settings', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    }
  }, [canEditProfile]);

  const handleImagePicker = async () => {
    Alert.alert(
      'Select Image',
      'Choose how you want to select an image',
      [
        { text: 'Camera', onPress: () => openImagePicker('camera') },
        { text: 'Gallery', onPress: () => openImagePicker('gallery') },
        ...(selectedImage ? [{ text: 'Remove Image', onPress: () => setSelectedImage(null), style: 'destructive' }] : []),
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const openImagePicker = async (source) => {
    try {
      console.log('📸 Opening image picker:', source);
      
      const permissionResult = source === 'camera' 
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert('Permission Required', `${source === 'camera' ? 'Camera' : 'Photo library'} access is required to select images`);
        return;
      }

      const options = {
        mediaTypes: ImagePicker.MediaType.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
        base64: false, // לא צריך base64, רק URI
      };

      console.log('🔧 Image picker options:', options);

      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);

      console.log('📷 Image picker result:', result);

      if (!result.canceled && result.assets?.[0]) {
        const selectedUri = result.assets[0].uri;
        console.log('✅ Image selected:', selectedUri);
        console.log('📏 Image dimensions:', result.assets[0].width, 'x', result.assets[0].height);
        
        setSelectedImage(selectedUri);
        
        // הודעה למשתמש שהתמונה נבחרה
        Alert.alert('Image Selected', 'Image has been selected. Don\'t forget to save your changes!');
      } else {
        console.log('❌ Image selection cancelled or failed');
      }
    } catch (error) {
      console.error('❌ Image picker error:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  const handleSaveChanges = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Group name is required');
      return;
    }

    setLoading(true);
    try {
      console.log('💾 Starting group save...');
      console.log('Original image:', groupData?.image);
      console.log('Selected image:', selectedImage);
      
      // נתונים שכולם יכולים לערוך
      const profileUpdateData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        category: formData.category,
        updatedBy: currentUser?.id || currentUser?._id
      };

      // נתונים שרק אדמינים יכולים לערוך
      if (canEditSettings) {
        profileUpdateData.rules = formData.rules.trim();
        profileUpdateData.isPrivate = formData.isPrivate;
        profileUpdateData.allowMemberPosts = formData.allowMemberPosts;
        profileUpdateData.requireApproval = formData.isPrivate ? formData.requireApproval : false;
        profileUpdateData.allowInvites = formData.allowInvites;
      }

      // בדיקה אם התמונה השתנתה
      let imageToUpload = null;
      if (selectedImage !== groupData?.image) {
        if (selectedImage === null) {
          // המשתמש רוצה למחוק את התמונה
          profileUpdateData.removeImage = true;
          console.log('🗑️ Removing image');
        } else if (selectedImage && selectedImage.startsWith('file://')) {
          // המשתמש בחר תמונה חדשה
          imageToUpload = selectedImage;
          console.log('📸 New image selected:', imageToUpload);
        }
      }

      console.log('📤 Sending update data:', profileUpdateData);
      const result = await groupService.updateGroup(groupId, profileUpdateData, imageToUpload);

      if (result.success) {
        console.log('✅ Group updated successfully');
        
        // עדכן את הסטייט המקומי אם יש תמונה חדשה
        if (result.data?.image) {
          setSelectedImage(result.data.image);
        } else if (profileUpdateData.removeImage) {
          setSelectedImage(null);
        }
        
        Alert.alert('Success', 'Group updated successfully', [
          { 
            text: 'OK', 
            onPress: () => {
              // העבר את המידע המעודכן חזרה
              if (route.params?.onGroupUpdated) {
                route.params.onGroupUpdated(result.data);
              }
              navigation.goBack();
            }
          }
        ]);
      } else {
        console.error('❌ Update failed:', result.message);
        Alert.alert('Error', result.message || 'Failed to update group');
      }
    } catch (error) {
      console.error('❌ Update group error:', error);
      Alert.alert('Error', 'Failed to update group. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!isCreator) {
      Alert.alert('Permission Denied', 'Only the group creator can delete the group');
      return;
    }

    setShowDeleteConfirm(true);
  };

  const confirmDeleteGroup = async () => {
    setShowDeleteConfirm(false);
    setLoading(true);

    try {
      const result = await groupService.deleteGroup(groupId, currentUser?.id || currentUser?._id);

      if (result.success) {
        Alert.alert('Group Deleted', 'The group has been permanently deleted', [
          { text: 'OK', onPress: () => navigation.navigate('Groups') }
        ]);
      } else {
        Alert.alert('Error', result.message || 'Failed to delete group');
      }
    } catch (error) {
      console.error('Delete group error:', error);
      Alert.alert('Error', 'Failed to delete group');
    } finally {
      setLoading(false);
    }
  };

  const renderCategoryModal = () => (
    <Modal
      visible={showCategoryModal}
      animationType="slide"
      onRequestClose={() => setShowCategoryModal(false)}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity 
            onPress={() => setShowCategoryModal(false)}
            style={styles.modalCloseButton}
          >
            <Ionicons name="close" size={24} color={FLAVORWORLD_COLORS.accent} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Select Category</Text>
          <View style={styles.modalPlaceholder} />
        </View>
        
        <ScrollView style={styles.categoryList}>
          {CATEGORIES.map((category) => (
            <TouchableOpacity
              key={category}
              style={[
                styles.categoryItem,
                formData.category === category && styles.selectedCategoryItem
              ]}
              onPress={() => {
                setFormData(prev => ({ ...prev, category }));
                setShowCategoryModal(false);
              }}
            >
              <Text style={[
                styles.categoryItemText,
                formData.category === category && styles.selectedCategoryItemText
              ]}>
                {category}
              </Text>
              {formData.category === category && (
                <Ionicons name="checkmark" size={20} color={FLAVORWORLD_COLORS.primary} />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );

  const renderDeleteConfirmModal = () => (
    <Modal
      visible={showDeleteConfirm}
      transparent
      animationType="fade"
      onRequestClose={() => setShowDeleteConfirm(false)}
    >
      <View style={styles.deleteModalOverlay}>
        <View style={styles.deleteModalContainer}>
          <View style={styles.deleteModalHeader}>
            <Ionicons name="warning" size={48} color={FLAVORWORLD_COLORS.danger} />
            <Text style={styles.deleteModalTitle}>Delete Group</Text>
          </View>
          
          <Text style={styles.deleteModalText}>
            Are you sure you want to delete "{groupData?.name}"?
          </Text>
          <Text style={styles.deleteModalSubtext}>
            This action cannot be undone. All posts, members, and data will be permanently lost.
          </Text>
          
          <View style={styles.deleteModalActions}>
            <TouchableOpacity
              style={styles.deleteModalCancelButton}
              onPress={() => setShowDeleteConfirm(false)}
            >
              <Text style={styles.deleteModalCancelText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.deleteModalConfirmButton}
              onPress={confirmDeleteGroup}
            >
              <Text style={styles.deleteModalConfirmText}>Delete Group</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  if (!canEditProfile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="lock-closed" size={80} color={FLAVORWORLD_COLORS.danger} />
          <Text style={styles.errorTitle}>Access Denied</Text>
          <Text style={styles.errorSubtitle}>Only group members can access settings</Text>
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
          style={styles.headerBackButton} 
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={FLAVORWORLD_COLORS.accent} />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Group Settings</Text>
        
        <TouchableOpacity 
          style={[styles.headerSaveButton, loading && styles.headerSaveButtonDisabled]}
          onPress={handleSaveChanges}
          disabled={loading}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={FLAVORWORLD_COLORS.white} />
              <Text style={styles.loadingText}>Saving...</Text>
            </View>
          ) : (
            <Text style={styles.headerSaveText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Cover Image Section - כולם יכולים לערוך */}
        <View style={styles.section}>
          <View style={styles.imageHeader}>
            <Text style={styles.sectionTitle}>Cover Image</Text>
            {selectedImage && selectedImage !== groupData?.image && (
              <View style={styles.changeIndicator}>
                <Ionicons name="checkmark-circle" size={16} color={FLAVORWORLD_COLORS.success} />
                <Text style={styles.changeText}>Changed</Text>
              </View>
            )}
          </View>
          
          <TouchableOpacity style={styles.imageContainer} onPress={handleImagePicker}>
            {selectedImage ? (
              <Image 
                source={{ uri: selectedImage }} 
                style={styles.coverImage}
                onError={(error) => {
                  console.log('❌ Image load error:', error.nativeEvent.error);
                  Alert.alert('Error', 'Failed to load image');
                  setSelectedImage(groupData?.image || null);
                }}
                onLoad={() => {
                  console.log('✅ Image loaded successfully');
                }}
              />
            ) : (
              <View style={styles.placeholderImage}>
                <Ionicons name="camera" size={40} color={FLAVORWORLD_COLORS.textLight} />
                <Text style={styles.placeholderText}>Tap to add cover image</Text>
              </View>
            )}
            <View style={styles.imageOverlay}>
              <Ionicons name="camera" size={24} color={FLAVORWORLD_COLORS.white} />
            </View>
          </TouchableOpacity>
          
          {selectedImage && (
            <TouchableOpacity 
              style={styles.removeImageButton}
              onPress={() => {
                Alert.alert(
                  'Remove Image',
                  'Are you sure you want to remove the cover image?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Remove', style: 'destructive', onPress: () => setSelectedImage(null) }
                  ]
                );
              }}
            >
              <Ionicons name="trash-outline" size={16} color={FLAVORWORLD_COLORS.danger} />
              <Text style={styles.removeImageText}>Remove Image</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Basic Information - כולם יכולים לערוך */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Group Profile</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Group Name *</Text>
            <TextInput
              style={styles.textInput}
              value={formData.name}
              onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
              placeholder="Enter group name"
              maxLength={50}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={formData.description}
              onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
              placeholder="Describe your group"
              multiline
              numberOfLines={4}
              maxLength={500}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Category</Text>
            <TouchableOpacity
              style={styles.categoryButton}
              onPress={() => setShowCategoryModal(true)}
            >
              <Text style={styles.categoryButtonText}>{formData.category}</Text>
              <Ionicons name="chevron-down" size={20} color={FLAVORWORLD_COLORS.textLight} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Admin Settings - רק אדמינים יכולים לערוך */}
        {canEditSettings && (
          <>
            <View style={styles.section}>
              <View style={styles.adminHeader}>
                <Ionicons name="shield-checkmark" size={20} color={FLAVORWORLD_COLORS.warning} />
                <Text style={[styles.sectionTitle, styles.adminTitle]}>Admin Settings</Text>
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Group Rules</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={formData.rules}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, rules: text }))}
                  placeholder="Set rules for your group (optional)"
                  multiline
                  numberOfLines={4}
                  maxLength={1000}
                />
              </View>
            </View>

            {/* Privacy Settings */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Privacy & Permissions</Text>
              
              <View style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Private Group</Text>
                  <Text style={styles.settingDescription}>
                    Only members can see posts and join by invitation
                  </Text>
                </View>
                <Switch
                  value={formData.isPrivate}
                  onValueChange={(value) => setFormData(prev => ({ 
                    ...prev, 
                    isPrivate: value,
                    requireApproval: value ? prev.requireApproval : false
                  }))}
                  trackColor={{ false: FLAVORWORLD_COLORS.border, true: FLAVORWORLD_COLORS.primary }}
                  thumbColor={FLAVORWORLD_COLORS.white}
                />
              </View>

              {formData.isPrivate && (
                <View style={styles.settingItem}>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingTitle}>Require Approval</Text>
                    <Text style={styles.settingDescription}>
                      New members need admin approval to join
                    </Text>
                  </View>
                  <Switch
                    value={formData.requireApproval}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, requireApproval: value }))}
                    trackColor={{ false: FLAVORWORLD_COLORS.border, true: FLAVORWORLD_COLORS.primary }}
                    thumbColor={FLAVORWORLD_COLORS.white}
                  />
                </View>
              )}

              <View style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Allow Member Posts</Text>
                  <Text style={styles.settingDescription}>
                    Members can share recipes in this group
                  </Text>
                </View>
                <Switch
                  value={formData.allowMemberPosts}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, allowMemberPosts: value }))}
                  trackColor={{ false: FLAVORWORLD_COLORS.border, true: FLAVORWORLD_COLORS.primary }}
                  thumbColor={FLAVORWORLD_COLORS.white}
                />
              </View>

              <View style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Allow Invitations</Text>
                  <Text style={styles.settingDescription}>
                    Members can invite others to join the group
                  </Text>
                </View>
                <Switch
                  value={formData.allowInvites}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, allowInvites: value }))}
                  trackColor={{ false: FLAVORWORLD_COLORS.border, true: FLAVORWORLD_COLORS.primary }}
                  thumbColor={FLAVORWORLD_COLORS.white}
                />
              </View>
            </View>

            {/* Danger Zone - רק יוצר הקבוצה */}
            {isCreator && (
              <View style={[styles.section, styles.dangerSection]}>
                <Text style={[styles.sectionTitle, styles.dangerTitle]}>Danger Zone</Text>
                
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={handleDeleteGroup}
                  disabled={loading}
                >
                  <Ionicons name="trash" size={20} color={FLAVORWORLD_COLORS.danger} />
                  <Text style={styles.deleteButtonText}>Delete Group</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        {/* הודעה למשתמשים שאינם אדמינים */}
        {!canEditSettings && (
          <View style={styles.infoSection}>
            <View style={styles.infoCard}>
              <Ionicons name="information-circle" size={24} color={FLAVORWORLD_COLORS.info} />
              <Text style={styles.infoText}>
                You can edit the group profile. Additional settings are available to group admins.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {renderCategoryModal()}
      {renderDeleteConfirmModal()}
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
  headerBackButton: {
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
  headerSaveButton: {
    backgroundColor: FLAVORWORLD_COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 60,
    alignItems: 'center',
  },
  headerSaveButtonDisabled: {
    opacity: 0.6,
  },
  headerSaveText: {
    color: FLAVORWORLD_COLORS.white,
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingText: {
    color: FLAVORWORLD_COLORS.white,
    fontSize: 12,
    marginLeft: 6,
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: FLAVORWORLD_COLORS.white,
    marginBottom: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: FLAVORWORLD_COLORS.text,
    marginBottom: 16,
  },
  imageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  changeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(39, 174, 96, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  changeText: {
    fontSize: 12,
    color: FLAVORWORLD_COLORS.success,
    fontWeight: '600',
    marginLeft: 4,
  },
  adminHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  adminTitle: {
    marginLeft: 8,
    marginBottom: 0,
    color: FLAVORWORLD_COLORS.warning,
  },
  imageContainer: {
    position: 'relative',
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: FLAVORWORLD_COLORS.border,
    borderStyle: 'dashed',
  },
  coverImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholderImage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: FLAVORWORLD_COLORS.background,
  },
  placeholderText: {
    marginTop: 8,
    fontSize: 14,
    color: FLAVORWORLD_COLORS.textLight,
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    padding: 8,
  },
  removeImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(231, 76, 60, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: FLAVORWORLD_COLORS.danger,
  },
  removeImageText: {
    fontSize: 14,
    color: FLAVORWORLD_COLORS.danger,
    fontWeight: '500',
    marginLeft: 6,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: FLAVORWORLD_COLORS.text,
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: FLAVORWORLD_COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: FLAVORWORLD_COLORS.text,
    backgroundColor: FLAVORWORLD_COLORS.background,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  categoryButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: FLAVORWORLD_COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: FLAVORWORLD_COLORS.background,
  },
  categoryButtonText: {
    fontSize: 16,
    color: FLAVORWORLD_COLORS.text,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: FLAVORWORLD_COLORS.border,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: FLAVORWORLD_COLORS.text,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: FLAVORWORLD_COLORS.textLight,
    lineHeight: 20,
  },
  dangerSection: {
    borderWidth: 2,
    borderColor: FLAVORWORLD_COLORS.danger,
    borderRadius: 12,
    marginHorizontal: 16,
  },
  dangerTitle: {
    color: FLAVORWORLD_COLORS.danger,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(231, 76, 60, 0.1)',
    borderWidth: 1,
    borderColor: FLAVORWORLD_COLORS.danger,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: FLAVORWORLD_COLORS.danger,
    marginLeft: 8,
  },
  infoSection: {
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  infoCard: {
    backgroundColor: FLAVORWORLD_COLORS.white,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderLeftWidth: 4,
    borderLeftColor: FLAVORWORLD_COLORS.info,
  },
  infoText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: FLAVORWORLD_COLORS.text,
    lineHeight: 20,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: FLAVORWORLD_COLORS.text,
    marginTop: 16,
    marginBottom: 8,
  },
  errorSubtitle: {
    fontSize: 16,
    color: FLAVORWORLD_COLORS.textLight,
    textAlign: 'center',
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: FLAVORWORLD_COLORS.white,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: FLAVORWORLD_COLORS.border,
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
  categoryList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: FLAVORWORLD_COLORS.border,
  },
  selectedCategoryItem: {
    backgroundColor: FLAVORWORLD_COLORS.background,
  },
  categoryItemText: {
    fontSize: 16,
    color: FLAVORWORLD_COLORS.text,
  },
  selectedCategoryItemText: {
    color: FLAVORWORLD_COLORS.primary,
    fontWeight: '600',
  },
  // Delete Modal Styles
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  deleteModalContainer: {
    backgroundColor: FLAVORWORLD_COLORS.white,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  deleteModalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  deleteModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: FLAVORWORLD_COLORS.danger,
    marginTop: 12,
  },
  deleteModalText: {
    fontSize: 16,
    color: FLAVORWORLD_COLORS.text,
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: '600',
  },
  deleteModalSubtext: {
    fontSize: 14,
    color: FLAVORWORLD_COLORS.textLight,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  deleteModalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  deleteModalCancelButton: {
    flex: 1,
    backgroundColor: FLAVORWORLD_COLORS.background,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: FLAVORWORLD_COLORS.border,
  },
  deleteModalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: FLAVORWORLD_COLORS.text,
  },
  deleteModalConfirmButton: {
    flex: 1,
    backgroundColor: FLAVORWORLD_COLORS.danger,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  deleteModalConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: FLAVORWORLD_COLORS.white,
  },
});

export default GroupSettingsScreen;