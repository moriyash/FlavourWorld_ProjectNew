
import React, { useState } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../../services/AuthContext';
import UserAvatar from '../../common/UserAvatar';
import PasswordInput from '../../common/PasswordInput';
import { userService } from '../../../services/UserService';

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

const EditProfileScreen = ({ navigation }) => {
  const { currentUser, updateUserProfile } = useAuth();
  
  const [fullName, setFullName] = useState(currentUser?.fullName || currentUser?.name || '');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [newAvatar, setNewAvatar] = useState(null);
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const handlePickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('Permission Required', 'Please allow access to your photo library');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1], 
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setNewAvatar(result.assets[0]);
      }
    } catch (error) {
      console.error('Image picker error occurred');
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleSaveProfile = async () => {
    if (!fullName.trim()) {
      Alert.alert('Validation Error', 'Please enter your full name');
      return;
    }

    setIsLoading(true);

    try {
      let avatarUrl = currentUser?.avatar;

      if (newAvatar) {
        setIsUploadingAvatar(true);
        const avatarResult = await userService.updateAvatar(newAvatar.uri);
        
        if (avatarResult.success) {
          avatarUrl = avatarResult.data.url;
          console.log('Avatar uploaded successfully');
        } else {
          Alert.alert('Error', avatarResult.message || 'Failed to upload avatar');
          return;
        }
        setIsUploadingAvatar(false);
      }

      const profileData = {
        userId: currentUser?.id || currentUser?._id,
        fullName: fullName.trim(),
        bio: bio.trim(),
      };

      if (avatarUrl && avatarUrl !== currentUser?.avatar) {
        profileData.avatar = avatarUrl;
      }

      console.log('Sending profile update');

      const result = await userService.updateProfile(profileData);

      if (result.success) {
        await updateUserProfile({
          fullName: fullName.trim(),
          name: fullName.trim(),
          bio: bio.trim(),
          avatar: avatarUrl,
        });

        Alert.alert(
          'Success! ',
          'Your profile has been updated successfully',
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack()
            }
          ]
        );
      } else {
        Alert.alert('Error', result.message || 'Failed to update profile');
        return;
      }

    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to update profile');
    } finally {
      setIsLoading(false);
      setIsUploadingAvatar(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Validation Error', 'Please fill in all password fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Validation Error', 'New passwords do not match');
      return;
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z]).{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      Alert.alert(
        'Invalid Password', 
        'Password must contain at least 8 characters, including uppercase and lowercase letters, a number and a special character'
      );
      return;
    }

    setIsLoading(true);

    try {
      const result = await userService.changePassword({
        userId: currentUser?.id || currentUser?._id,
        currentPassword,
        newPassword
      });

      if (result.success) {
        setIsLoading(false);
        
        Alert.alert('Success! ', 'Your password has been changed successfully', [
          {
            text: 'OK',
            onPress: () => {
              setShowPasswordModal(false);
              setCurrentPassword('');
              setNewPassword('');
              setConfirmPassword('');
            }
          }
        ]);
      } else {
        Alert.alert('Error', result.message || 'Failed to change password');
        return;
      }
    } catch (error) {
      setIsLoading(false);
      
      console.error('Change password error occurred');
      Alert.alert('Error', error.message || 'Failed to change password');
    }
  };

  const renderPasswordModal = () => (
    <Modal
      visible={showPasswordModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowPasswordModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Change Password</Text>
            <TouchableOpacity 
              onPress={() => setShowPasswordModal(false)}
              style={styles.modalCloseButton}
            >
              <Ionicons name="close" size={24} color={FLAVORWORLD_COLORS.accent} />
            </TouchableOpacity>
          </View>

          <View style={styles.modalBody}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Current Password</Text>
              <PasswordInput
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Enter current password"
                isConfirmation={true}
                style={styles.passwordInputStyle}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>New Password</Text>
              <PasswordInput
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Enter new password"
                isConfirmation={false}
                style={styles.passwordInputStyle}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirm New Password</Text>
              <PasswordInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm new password"
                isConfirmation={true}
                style={styles.passwordInputStyle}
              />
            </View>

            <TouchableOpacity
              style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
              onPress={handleChangePassword}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={FLAVORWORLD_COLORS.white} />
              ) : (
                <Text style={styles.saveButtonText}>Change Password</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/**/}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={FLAVORWORLD_COLORS.accent} />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Edit Profile</Text>
        
        <TouchableOpacity
          style={[styles.saveHeaderButton, isLoading && styles.saveHeaderButtonDisabled]}
          onPress={handleSaveProfile}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={FLAVORWORLD_COLORS.primary} />
          ) : (
            <Text style={styles.saveHeaderButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/**/}
        <View style={styles.avatarSection}>
          <View style={styles.avatarContainer}>
            <UserAvatar
              uri={newAvatar?.uri || currentUser?.avatar}
              name={currentUser?.fullName || currentUser?.name}
              size={120}
            />
            
            {isUploadingAvatar && (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator size="large" color={FLAVORWORLD_COLORS.primary} />
              </View>
            )}
          </View>
          
          <TouchableOpacity 
            style={styles.changePhotoButton}
            onPress={handlePickImage}
            disabled={isUploadingAvatar}
          >
            <Ionicons name="camera" size={20} color={FLAVORWORLD_COLORS.primary} />
            <Text style={styles.changePhotoText}>Change Photo</Text>
          </TouchableOpacity>
        </View>

        {/**/}
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Profile Information</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Enter your full name"
              placeholderTextColor={FLAVORWORLD_COLORS.textLight}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={[styles.input, styles.inputDisabled]}
              value={currentUser?.email || ''}
              editable={false}
              placeholder="Email address"
              placeholderTextColor={FLAVORWORLD_COLORS.textLight}
            />
            <Text style={styles.helpText}>Email cannot be changed</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Bio</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={bio}
              onChangeText={setBio}
              placeholder="Tell us about yourself and your cooking passion..."
              placeholderTextColor={FLAVORWORLD_COLORS.textLight}
              multiline
              numberOfLines={4}
              maxLength={500}
            />
            <Text style={styles.characterCount}>{bio.length}/500</Text>
          </View>
        </View>

        {/**/}
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Security</Text>
          
          <TouchableOpacity 
            style={styles.passwordButton}
            onPress={() => setShowPasswordModal(true)}
          >
            <View style={styles.passwordButtonContent}>
              <Ionicons name="lock-closed-outline" size={20} color={FLAVORWORLD_COLORS.accent} />
              <Text style={styles.passwordButtonText}>Change Password</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={FLAVORWORLD_COLORS.textLight} />
          </TouchableOpacity>
        </View>

        {/**/}
        <View style={styles.buttonSection}>
          <TouchableOpacity
            style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
            onPress={handleSaveProfile}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={FLAVORWORLD_COLORS.white} />
            ) : (
              <>
                <Ionicons name="checkmark" size={20} color={FLAVORWORLD_COLORS.white} />
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={{ height: 50 }} />
      </ScrollView>

      {renderPasswordModal()}
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
  saveHeaderButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: FLAVORWORLD_COLORS.background,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: FLAVORWORLD_COLORS.primary,
  },
  saveHeaderButtonDisabled: {
    opacity: 0.6,
  },
  saveHeaderButtonText: {
    color: FLAVORWORLD_COLORS.primary,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 30,
    backgroundColor: FLAVORWORLD_COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: FLAVORWORLD_COLORS.border,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  changePhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: FLAVORWORLD_COLORS.background,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: FLAVORWORLD_COLORS.primary,
  },
  changePhotoText: {
    color: FLAVORWORLD_COLORS.primary,
    fontWeight: '600',
    marginLeft: 8,
  },
  formSection: {
    backgroundColor: FLAVORWORLD_COLORS.white,
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: FLAVORWORLD_COLORS.text,
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: FLAVORWORLD_COLORS.text,
    marginBottom: 8,
  },
  input: {
    borderWidth: 2,
    borderColor: FLAVORWORLD_COLORS.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    backgroundColor: FLAVORWORLD_COLORS.white,
    color: FLAVORWORLD_COLORS.text,
  },
  inputDisabled: {
    backgroundColor: FLAVORWORLD_COLORS.background,
    color: FLAVORWORLD_COLORS.textLight,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  helpText: {
    fontSize: 12,
    color: FLAVORWORLD_COLORS.textLight,
    marginTop: 4,
  },
  characterCount: {
    fontSize: 12,
    color: FLAVORWORLD_COLORS.textLight,
    textAlign: 'right',
    marginTop: 4,
  },
  passwordButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: FLAVORWORLD_COLORS.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: FLAVORWORLD_COLORS.border,
  },
  passwordButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordButtonText: {
    fontSize: 16,
    color: FLAVORWORLD_COLORS.text,
    marginLeft: 12,
    fontWeight: '500',
  },
  buttonSection: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: FLAVORWORLD_COLORS.primary,
    paddingVertical: 16,
    borderRadius: 25,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  saveButtonDisabled: {
    backgroundColor: FLAVORWORLD_COLORS.textLight,
    elevation: 0,
    shadowOpacity: 0,
  },
  saveButtonText: {
    color: FLAVORWORLD_COLORS.white,
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: FLAVORWORLD_COLORS.white,
    borderRadius: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: FLAVORWORLD_COLORS.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: FLAVORWORLD_COLORS.text,
  },
  modalCloseButton: {
    padding: 8,
    backgroundColor: FLAVORWORLD_COLORS.background,
    borderRadius: 20,
  },
  modalBody: {
    padding: 20,
  },
  passwordInputStyle: {
    marginBottom: 0,
  },
});

export default EditProfileScreen;