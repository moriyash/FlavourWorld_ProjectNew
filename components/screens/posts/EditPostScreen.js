
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
  Image,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { recipeService } from '../../../services/recipeService';
import { groupService } from '../../../services/GroupService';
import { useAuth } from '../../../services/AuthContext';

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

const RECIPE_CATEGORIES = [
  'Asian', 'Italian', 'Mexican', 'Indian', 'Mediterranean', 
  'American', 'French', 'Chinese', 'Japanese', 'Thai', 
  'Middle Eastern', 'Greek', 'Spanish', 'Korean', 'Vietnamese'
];

const MEAT_TYPES = [
  'Vegetarian', 'Vegan', 'Chicken', 'Beef', 'Pork', 
  'Fish', 'Seafood', 'Lamb', 'Turkey', 'Mixed'
];

const EditPostScreen = ({ route, navigation }) => {
  const { currentUser } = useAuth();
  
  const { postId, postData, isGroupPost = false, groupId = null, groupName = null } = route.params;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [instructions, setInstructions] = useState('');
  const [category, setCategory] = useState('');
  const [meatType, setMeatType] = useState('');
  const [prepTimeHours, setPrepTimeHours] = useState('');
  const [prepTimeMinutes, setPrepTimeMinutes] = useState('');
  const [servings, setServings] = useState('');
  const [image, setImage] = useState(null);
  const [originalImage, setOriginalImage] = useState(null);
  
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showMeatTypeModal, setShowMeatTypeModal] = useState(false);

  useEffect(() => {
    if (postData) {
      console.log('Loading existing post data for editing:', postData.title);
      
      setTitle(postData.title || '');
      setDescription(postData.description || '');
      setIngredients(postData.ingredients || '');
      setInstructions(postData.instructions || '');
      setCategory(postData.category || '');
      setMeatType(postData.meatType || '');
      setServings(postData.servings?.toString() || '');
      
      const totalMinutes = postData.prepTime || 0;
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      setPrepTimeHours(hours > 0 ? hours.toString() : '');
      setPrepTimeMinutes(minutes > 0 ? minutes.toString() : '');
      
      if (postData.image) {
        setOriginalImage(postData.image);
      }
    }
  }, [postData]);

  const validateForm = () => {
    const newErrors = {};

    if (!title || title.trim() === '') {
      newErrors.title = 'Recipe title is required';
    }
    
    if (!description || description.trim() === '') {
      newErrors.description = 'Recipe description is required';
    }
    
    if (!ingredients || ingredients.trim() === '') {
      newErrors.ingredients = 'Ingredients list is required';
    }
    
    if (!instructions || instructions.trim() === '') {
      newErrors.instructions = 'Cooking instructions are required';
    }
    
    if (!category || category.trim() === '') {
      newErrors.category = 'Recipe category is required';
    }
    
    if (!meatType || meatType.trim() === '') {
      newErrors.meatType = 'Meat type is required';
    }
    
    if (!servings || servings.trim() === '') {
      newErrors.servings = 'Number of servings is required';
    }
    
    const hours = parseInt(prepTimeHours) || 0;
    const minutes = parseInt(prepTimeMinutes) || 0;
    if (hours === 0 && minutes === 0) {
      newErrors.prepTime = 'Preparation time is required';
    }

    if (servings && isNaN(parseInt(servings))) {
      newErrors.servings = 'Servings must be a number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const pickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('Permission Required', 'Please allow access to your photo library to update the image');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setImage(result.assets[0]);
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const removeImage = () => {
    setImage(null);
    setOriginalImage(null);
  };

  const handleSubmit = async () => {
    console.log('Updating post...');
    
    if (!validateForm()) {
      Alert.alert('Missing Information', 'Please fill in all required fields');
      return;
    }

    setIsLoading(true);

    try {
      const totalMinutes = (parseInt(prepTimeHours) || 0) * 60 + (parseInt(prepTimeMinutes) || 0);
      
      const updateData = {
        title: title.trim(),
        description: description.trim(),
        ingredients: ingredients.trim(),
        instructions: instructions.trim(),
        category: category,
        meatType: meatType,
        prepTime: totalMinutes,
        servings: parseInt(servings) || 1,
        userId: currentUser?.id || currentUser?._id || currentUser?.userId || 'unknown',
      };

      console.log('Update data:', {
        ...updateData,
        isGroupPost,
        groupId,
        hasNewImage: !!image,
        hasOriginalImage: !!originalImage
      });

      let result;
      
      let imageToSend = null;
      if (image) {
        imageToSend = image.uri;
      } else if (originalImage) {
        updateData.image = originalImage;
      }

      if (isGroupPost && groupId) {
        console.log(' Updating group post...');
        result = await groupService.updateGroupPost(groupId, postId, updateData, imageToSend);
      } else {
        console.log(' Updating regular post...');
        result = await recipeService.updateRecipe(postId, updateData, imageToSend);
      }

      if (result && result.success) {
        const successMessage = isGroupPost 
          ? `Recipe updated in ${groupName}! ✏️`
          : 'Recipe updated successfully! ';

        Alert.alert('Success', successMessage, [
          {
            text: 'OK',
            onPress: () => {
              navigation.goBack();
            }
          }
        ]);
      } else {
        Alert.alert('Update Failed', result ? result.message : 'Failed to update recipe. Please try again.');
      }
    } catch (error) {
      console.error('Update error:', error);
      Alert.alert('Error', 'Unable to update recipe. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const clearError = (field) => {
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const renderModalList = (data, onSelect, selectedValue) => (
    <FlatList
      data={data}
      keyExtractor={(item) => item}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={[
            styles.modalItem,
            selectedValue === item && styles.modalItemSelected
          ]}
          onPress={() => onSelect(item)}
        >
          <Text style={[
            styles.modalItemText,
            selectedValue === item && styles.modalItemTextSelected
          ]}>
            {item}
          </Text>
        </TouchableOpacity>
      )}
    />
  );

  const getCurrentImage = () => {
    if (image) {
      return { uri: image.uri };
    } else if (originalImage) {
      return { uri: originalImage };
    }
    return null;
  };

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
        
        <Text style={styles.headerTitle}>Edit Recipe</Text>
        
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/**/}
        {isGroupPost && groupName && (
          <View style={styles.groupHeader}>
            <View style={styles.groupHeaderIcon}>
              <Ionicons name="people" size={24} color={FLAVORWORLD_COLORS.secondary} />
            </View>
            <View style={styles.groupHeaderText}>
              <Text style={styles.groupHeaderTitle}>Editing in {groupName}</Text>
              <Text style={styles.groupHeaderSubtitle}>Update your recipe for the group</Text>
            </View>
          </View>
        )}

        <View style={styles.form}>
          {/**/}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Recipe Title *</Text>
            <TextInput
              style={[styles.input, errors.title && styles.inputError]}
              value={title}
              onChangeText={(text) => {
                setTitle(text);
                clearError('title');
              }}
              placeholder="What's cooking? Give your recipe a delicious name..."
              placeholderTextColor={FLAVORWORLD_COLORS.textLight}
            />
            {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}
          </View>

          {/**/}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description *</Text>
            <TextInput
              style={[styles.textArea, errors.description && styles.inputError]}
              value={description}
              onChangeText={(text) => {
                setDescription(text);
                clearError('description');
              }}
              placeholder="Tell us about your recipe... What makes it special?"
              placeholderTextColor={FLAVORWORLD_COLORS.textLight}
              multiline
              numberOfLines={3}
            />
            {errors.description && <Text style={styles.errorText}>{errors.description}</Text>}
          </View>

          {/**/}
          <View style={styles.rowContainer}>
            <View style={styles.halfWidth}>
              <Text style={styles.label}>Category *</Text>
              <TouchableOpacity
                style={[styles.selector, errors.category && styles.inputError]}
                onPress={() => setShowCategoryModal(true)}
              >
                <Text style={category ? styles.selectorText : styles.placeholderText}>
                  {category || 'Select cuisine'}
                </Text>
                <Ionicons name="chevron-down" size={20} color={FLAVORWORLD_COLORS.accent} />
              </TouchableOpacity>
              {errors.category && <Text style={styles.errorText}>{errors.category}</Text>}
            </View>

            <View style={styles.halfWidth}>
              <Text style={styles.label}>Type *</Text>
              <TouchableOpacity
                style={[styles.selector, errors.meatType && styles.inputError]}
                onPress={() => setShowMeatTypeModal(true)}
              >
                <Text style={meatType ? styles.selectorText : styles.placeholderText}>
                  {meatType || 'Select type'}
                </Text>
                <Ionicons name="chevron-down" size={20} color={FLAVORWORLD_COLORS.accent} />
              </TouchableOpacity>
              {errors.meatType && <Text style={styles.errorText}>{errors.meatType}</Text>}
            </View>
          </View>

          {/**/}
          <View style={styles.rowContainer}>
            <View style={styles.halfWidth}>
              <Text style={styles.label}>Prep Time *</Text>
              <View style={styles.timeContainer}>
                <TextInput
                  style={[styles.timeInput, errors.prepTime && styles.inputError]}
                  value={prepTimeHours}
                  onChangeText={(text) => {
                    setPrepTimeHours(text);
                    clearError('prepTime');
                  }}
                  placeholder="0"
                  placeholderTextColor={FLAVORWORLD_COLORS.textLight}
                  keyboardType="numeric"
                  maxLength={2}
                />
                <Text style={styles.timeLabel}>h</Text>
                <TextInput
                  style={[styles.timeInput, errors.prepTime && styles.inputError]}
                  value={prepTimeMinutes}
                  onChangeText={(text) => {
                    setPrepTimeMinutes(text);
                    clearError('prepTime');
                  }}
                  placeholder="30"
                  placeholderTextColor={FLAVORWORLD_COLORS.textLight}
                  keyboardType="numeric"
                  maxLength={2}
                />
                <Text style={styles.timeLabel}>m</Text>
              </View>
              {errors.prepTime && <Text style={styles.errorText}>{errors.prepTime}</Text>}
            </View>

            <View style={styles.halfWidth}>
              <Text style={styles.label}>Servings *</Text>
              <TextInput
                style={[styles.input, errors.servings && styles.inputError]}
                value={servings}
                onChangeText={(text) => {
                  setServings(text);
                  clearError('servings');
                }}
                placeholder="4"
                placeholderTextColor={FLAVORWORLD_COLORS.textLight}
                keyboardType="numeric"
                maxLength={2}
              />
              {errors.servings && <Text style={styles.errorText}>{errors.servings}</Text>}
            </View>
          </View>

          {/**/}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Ingredients *</Text>
            <TextInput
              style={[styles.textArea, errors.ingredients && styles.inputError]}
              value={ingredients}
              onChangeText={(text) => {
                setIngredients(text);
                clearError('ingredients');
              }}
              placeholder="List all ingredients and quantities..."
              placeholderTextColor={FLAVORWORLD_COLORS.textLight}
              multiline
              numberOfLines={4}
            />
            {errors.ingredients && <Text style={styles.errorText}>{errors.ingredients}</Text>}
          </View>

          {/**/}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Instructions *</Text>
            <TextInput
              style={[styles.textArea, errors.instructions && styles.inputError]}
              value={instructions}
              onChangeText={(text) => {
                setInstructions(text);
                clearError('instructions');
              }}
              placeholder="Share your cooking secrets... Step by step instructions"
              placeholderTextColor={FLAVORWORLD_COLORS.textLight}
              multiline
              numberOfLines={5}
            />
            {errors.instructions && <Text style={styles.errorText}>{errors.instructions}</Text>}
          </View>

          {/**/}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Recipe Photo</Text>
            
            {getCurrentImage() ? (
              <View style={styles.imageContainer}>
                <Image source={getCurrentImage()} style={styles.selectedImage} />
                <View style={styles.imageActions}>
                  <TouchableOpacity
                    style={styles.changeImageButton}
                    onPress={pickImage}
                  >
                    <Ionicons name="camera" size={16} color={FLAVORWORLD_COLORS.primary} />
                    <Text style={styles.changeImageText}>Change Photo</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.removeImageButton}
                    onPress={removeImage}
                  >
                    <Ionicons name="trash" size={16} color={FLAVORWORLD_COLORS.danger} />
                    <Text style={styles.removeImageText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
                <View style={styles.imagePickerPlaceholder}>
                  <Ionicons name="camera-outline" size={40} color={FLAVORWORLD_COLORS.secondary} />
                  <Text style={styles.imagePickerText}>Add a mouth-watering photo</Text>
                  <Text style={styles.imagePickerSubtext}>Make your recipe irresistible!</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>

          {/**/}
          <TouchableOpacity
            style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={FLAVORWORLD_COLORS.white} />
            ) : (
              <>
                <Ionicons 
                  name="checkmark" 
                  size={20} 
                  color={FLAVORWORLD_COLORS.white} 
                  style={{ marginRight: 8 }} 
                />
                <Text style={styles.submitButtonText}>Update Recipe</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/**/}
      <Modal
        visible={showCategoryModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Cuisine</Text>
              <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
                <Ionicons name="close" size={24} color={FLAVORWORLD_COLORS.accent} />
              </TouchableOpacity>
            </View>
            {renderModalList(RECIPE_CATEGORIES, (selectedCategory) => {
              setCategory(selectedCategory);
              setShowCategoryModal(false);
              clearError('category');
            }, category)}
          </View>
        </View>
      </Modal>

      {/**/}
      <Modal
        visible={showMeatTypeModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowMeatTypeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Type</Text>
              <TouchableOpacity onPress={() => setShowMeatTypeModal(false)}>
                <Ionicons name="close" size={24} color={FLAVORWORLD_COLORS.accent} />
              </TouchableOpacity>
            </View>
            {renderModalList(MEAT_TYPES, (selectedType) => {
              setMeatType(selectedType);
              setShowMeatTypeModal(false);
              clearError('meatType');
            }, meatType)}
          </View>
        </View>
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
  },
  placeholder: {
    width: 32,
  },
  scrollContainer: {
    flex: 1,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: FLAVORWORLD_COLORS.white,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: FLAVORWORLD_COLORS.secondary,
  },
  groupHeaderIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: FLAVORWORLD_COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  groupHeaderText: {
    flex: 1,
  },
  groupHeaderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: FLAVORWORLD_COLORS.text,
    marginBottom: 2,
  },
  groupHeaderSubtitle: {
    fontSize: 14,
    color: FLAVORWORLD_COLORS.textLight,
  },
  form: {
    padding: 16,
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
    borderWidth: 2,
    borderColor: FLAVORWORLD_COLORS.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    backgroundColor: FLAVORWORLD_COLORS.white,
    textAlignVertical: 'top',
    minHeight: 80,
    color: FLAVORWORLD_COLORS.text,
  },
  inputError: {
    borderColor: FLAVORWORLD_COLORS.danger,
  },
  errorText: {
    color: FLAVORWORLD_COLORS.danger,
    fontSize: 14,
    marginTop: 4,
    fontWeight: '500',
  },
  rowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  halfWidth: {
    width: '48%',
  },
  selector: {
    borderWidth: 2,
    borderColor: FLAVORWORLD_COLORS.border,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: FLAVORWORLD_COLORS.white,
  },
  selectorText: {
    fontSize: 16,
    color: FLAVORWORLD_COLORS.text,
  },
  placeholderText: {
    fontSize: 16,
    color: FLAVORWORLD_COLORS.textLight,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeInput: {
    borderWidth: 2,
    borderColor: FLAVORWORLD_COLORS.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    backgroundColor: FLAVORWORLD_COLORS.white,
    width: 50,
    textAlign: 'center',
    color: FLAVORWORLD_COLORS.text,
  },
  timeLabel: {
    fontSize: 16,
    color: FLAVORWORLD_COLORS.text,
    marginHorizontal: 8,
    fontWeight: '600',
  },
  imageContainer: {
    alignItems: 'center',
  },
  selectedImage: {
    width: 200,
    height: 150,
    borderRadius: 12,
    marginBottom: 12,
  },
  imageActions: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  changeImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: FLAVORWORLD_COLORS.background,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: FLAVORWORLD_COLORS.primary,
    marginRight: 12,
  },
  changeImageText: {
    fontSize: 14,
    color: FLAVORWORLD_COLORS.primary,
    marginLeft: 6,
    fontWeight: '500',
  },
  removeImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: FLAVORWORLD_COLORS.background,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: FLAVORWORLD_COLORS.danger,
  },
  removeImageText: {
    fontSize: 14,
    color: FLAVORWORLD_COLORS.danger,
    marginLeft: 6,
    fontWeight: '500',
  },
  imagePicker: {
    borderWidth: 2,
    borderColor: FLAVORWORLD_COLORS.secondary,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: FLAVORWORLD_COLORS.white,
  },
  imagePickerPlaceholder: {
    alignItems: 'center',
  },
  imagePickerText: {
    fontSize: 16,
    color: FLAVORWORLD_COLORS.text,
    marginTop: 8,
    fontWeight: '600',
  },
  imagePickerSubtext: {
    fontSize: 14,
    color: FLAVORWORLD_COLORS.textLight,
    marginTop: 4,
  },
  submitButton: {
    backgroundColor: FLAVORWORLD_COLORS.success,
    borderRadius: 25,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  submitButtonDisabled: {
    backgroundColor: FLAVORWORLD_COLORS.textLight,
    elevation: 0,
    shadowOpacity: 0,
  },
  submitButtonText: {
    color: FLAVORWORLD_COLORS.white,
    fontSize: 18,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: FLAVORWORLD_COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: FLAVORWORLD_COLORS.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: FLAVORWORLD_COLORS.text,
  },
  modalItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: FLAVORWORLD_COLORS.border,
  },
  modalItemSelected: {
    backgroundColor: FLAVORWORLD_COLORS.background,
  },
  modalItemText: {
    fontSize: 16,
    color: FLAVORWORLD_COLORS.text,
  },
  modalItemTextSelected: {
    color: FLAVORWORLD_COLORS.primary,
    fontWeight: '600',
  },
});

export default EditPostScreen;