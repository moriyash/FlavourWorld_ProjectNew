
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
  Image,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../services/AuthContext';
import { groupService } from '../../services/GroupService';

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

const CATEGORIES = [
  'General',
  'Baking & Desserts',
  'Main Courses',
  'Appetizers',
  'Salads',
  'Soups',
  'Vegetarian',
  'Vegan',
  'Gluten-Free',
  'Quick Meals',
  'Holiday Recipes',
  'International Cuisine'
];

const CreateGroupComponent = ({ navigation, onGroupCreated }) => {
  const { currentUser } = useAuth();
  
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('General');
  const [rules, setRules] = useState('');
  const [groupImage, setGroupImage] = useState(null);
  
  const [isPrivate, setIsPrivate] = useState(false);
  const [allowMemberPosts, setAllowMemberPosts] = useState(true);
  const [requireApproval, setRequireApproval] = useState(true);
  const [allowInvites, setAllowInvites] = useState(true);
  
  const [isLoading, setIsLoading] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

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
        aspect: [16, 9], 
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setGroupImage(result.assets[0]);
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert('Validation Error', 'Please enter a group name');
      return;
    }

    if (groupName.length < 3) {
      Alert.alert('Validation Error', 'Group name must be at least 3 characters');
      return;
    }

    if (groupName.length > 50) {
      Alert.alert('Validation Error', 'Group name must be less than 50 characters');
      return;
    }

    setIsLoading(true);

    try {
      const groupData = {
        name: groupName.trim(),
        description: description.trim(),
        category,
        rules: rules.trim(),
        creatorId: currentUser?.id || currentUser?._id,
        isPrivate,
        allowMemberPosts,
        requireApproval,
        allowInvites
      };

      console.log('Creating group with data:', groupData);

      const result = await groupService.createGroup(groupData, groupImage?.uri);

      if (result.success) {
        Alert.alert(
          'Success! 🎉',
          'Your group has been created successfully!',
          [
            {
              text: 'OK',
              onPress: () => {
                if (onGroupCreated) {
                  onGroupCreated(result.data);
                }
                if (navigation) {
                  navigation.goBack();
                }
              }
            }
          ]
        );
      } else {
        throw new Error(result.message || 'Failed to create group');
      }

    } catch (error) {
      console.error('Create group error:', error);
      Alert.alert('Error', error.message || 'Failed to create group');
    } finally {
      setIsLoading(false);
    }
  };

  const renderCategoryPicker = () => (
    <View style={styles.categoryPicker}>
      <ScrollView style={styles.categoryList} showsVerticalScrollIndicator={false}>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[
              styles.categoryItem,
              category === cat && styles.categoryItemSelected
            ]}
            onPress={() => {
              setCategory(cat);
              setShowCategoryPicker(false);
            }}
          >
            <Text style={[
              styles.categoryItemText,
              category === cat && styles.categoryItemTextSelected
            ]}>
              {cat}
            </Text>
            {category === cat && (
              <Ionicons name="checkmark" size={20} color={FLAVORWORLD_COLORS.primary} />
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/**/}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation?.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={FLAVORWORLD_COLORS.accent} />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Create Group</Text>
        
        <TouchableOpacity
          style={[styles.createButton, isLoading && styles.createButtonDisabled]}
          onPress={handleCreateGroup}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={FLAVORWORLD_COLORS.primary} />
          ) : (
            <Text style={styles.createButtonText}>Create</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/**/}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Group Cover Image</Text>
          <TouchableOpacity 
            style={styles.imageContainer}
            onPress={handlePickImage}
          >
            {groupImage ? (
              <Image source={{ uri: groupImage.uri }} style={styles.coverImage} />
            ) : (
              <View style={styles.placeholderImage}>
                <Ionicons name="image-outline" size={40} color={FLAVORWORLD_COLORS.textLight} />
                <Text style={styles.placeholderText}>Add Cover Photo</Text>
              </View>
            )}
            <View style={styles.imageOverlay}>
              <Ionicons name="camera" size={20} color={FLAVORWORLD_COLORS.white} />
            </View>
          </TouchableOpacity>
        </View>

        {/**/}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Information</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Group Name *</Text>
            <TextInput
              style={styles.input}
              value={groupName}
              onChangeText={setGroupName}
              placeholder="Enter group name (e.g., Italian Cooking Masters)"
              placeholderTextColor={FLAVORWORLD_COLORS.textLight}
              maxLength={50}
            />
            <Text style={styles.characterCount}>{groupName.length}/50</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe what your group is about, what kind of recipes you'll share..."
              placeholderTextColor={FLAVORWORLD_COLORS.textLight}
              multiline
              numberOfLines={4}
              maxLength={500}
            />
            <Text style={styles.characterCount}>{description.length}/500</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Category</Text>
            <TouchableOpacity 
              style={styles.categorySelector}
              onPress={() => setShowCategoryPicker(!showCategoryPicker)}
            >
              <Text style={styles.categoryText}>{category}</Text>
              <Ionicons 
                name={showCategoryPicker ? "chevron-up" : "chevron-down"} 
                size={20} 
                color={FLAVORWORLD_COLORS.textLight} 
              />
            </TouchableOpacity>
            {showCategoryPicker && renderCategoryPicker()}
          </View>
        </View>

        {/**/}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Group Settings</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Private Group</Text>
              <Text style={styles.settingDescription}>
                Only members can see posts and member list
              </Text>
            </View>
            <Switch
              value={isPrivate}
              onValueChange={setIsPrivate}
              trackColor={{ false: FLAVORWORLD_COLORS.border, true: FLAVORWORLD_COLORS.primary }}
              thumbColor={FLAVORWORLD_COLORS.white}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Allow Member Posts</Text>
              <Text style={styles.settingDescription}>
                Members can create and share their own recipes
              </Text>
            </View>
            <Switch
              value={allowMemberPosts}
              onValueChange={setAllowMemberPosts}
              trackColor={{ false: FLAVORWORLD_COLORS.border, true: FLAVORWORLD_COLORS.primary }}
              thumbColor={FLAVORWORLD_COLORS.white}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Require Post Approval</Text>
              <Text style={styles.settingDescription}>
                Admin must approve posts before they're visible
              </Text>
            </View>
            <Switch
              value={requireApproval}
              onValueChange={setRequireApproval}
              trackColor={{ false: FLAVORWORLD_COLORS.border, true: FLAVORWORLD_COLORS.primary }}
              thumbColor={FLAVORWORLD_COLORS.white}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Allow Member Invites</Text>
              <Text style={styles.settingDescription}>
                Members can invite others to join the group
              </Text>
            </View>
            <Switch
              value={allowInvites}
              onValueChange={setAllowInvites}
              trackColor={{ false: FLAVORWORLD_COLORS.border, true: FLAVORWORLD_COLORS.primary }}
              thumbColor={FLAVORWORLD_COLORS.white}
            />
          </View>
        </View>

        {/**/}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Group Rules (Optional)</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Community Guidelines</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={rules}
              onChangeText={setRules}
              placeholder="Set some ground rules for your group members..."
              placeholderTextColor={FLAVORWORLD_COLORS.textLight}
              multiline
              numberOfLines={4}
              maxLength={1000}
            />
            <Text style={styles.characterCount}>{rules.length}/1000</Text>
          </View>
        </View>

        {/**/}
        <View style={styles.buttonSection}>
          <TouchableOpacity
            style={[styles.createFullButton, isLoading && styles.createFullButtonDisabled]}
            onPress={handleCreateGroup}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={FLAVORWORLD_COLORS.white} />
            ) : (
              <>
                <Ionicons name="people" size={20} color={FLAVORWORLD_COLORS.white} />
                <Text style={styles.createFullButtonText}>Create Group</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={{ height: 50 }} />
      </ScrollView>
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
  createButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: FLAVORWORLD_COLORS.background,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: FLAVORWORLD_COLORS.primary,
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    color: FLAVORWORLD_COLORS.primary,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  section: {
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
  imageContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  coverImage: {
    width: '100%',
    height: 150,
    borderRadius: 12,
    resizeMode: 'cover',
  },
  placeholderImage: {
    width: '100%',
    height: 150,
    backgroundColor: FLAVORWORLD_COLORS.background,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: FLAVORWORLD_COLORS.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: FLAVORWORLD_COLORS.textLight,
    fontSize: 16,
    marginTop: 8,
    fontWeight: '500',
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: FLAVORWORLD_COLORS.primary,
    borderRadius: 20,
    padding: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
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
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  characterCount: {
    fontSize: 12,
    color: FLAVORWORLD_COLORS.textLight,
    textAlign: 'right',
    marginTop: 4,
  },
  categorySelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: FLAVORWORLD_COLORS.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: FLAVORWORLD_COLORS.white,
  },
  categoryText: {
    fontSize: 16,
    color: FLAVORWORLD_COLORS.text,
  },
  categoryPicker: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: FLAVORWORLD_COLORS.border,
    borderRadius: 12,
    backgroundColor: FLAVORWORLD_COLORS.white,
    maxHeight: 200,
  },
  categoryList: {
    padding: 8,
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  categoryItemSelected: {
    backgroundColor: FLAVORWORLD_COLORS.background,
  },
  categoryItemText: {
    fontSize: 16,
    color: FLAVORWORLD_COLORS.text,
  },
  categoryItemTextSelected: {
    color: FLAVORWORLD_COLORS.primary,
    fontWeight: '600',
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
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: FLAVORWORLD_COLORS.text,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: FLAVORWORLD_COLORS.textLight,
    lineHeight: 18,
  },
  buttonSection: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  createFullButton: {
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
  createFullButtonDisabled: {
    backgroundColor: FLAVORWORLD_COLORS.textLight,
    elevation: 0,
    shadowOpacity: 0,
  },
  createFullButtonText: {
    color: FLAVORWORLD_COLORS.white,
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default CreateGroupComponent;