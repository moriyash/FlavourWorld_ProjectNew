import React, { useState } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { recipeService } from '../../../services/recipeService';

const RECIPE_CATEGORIES = [
  'Asian', 'Italian', 'Mexican', 'Indian', 'Mediterranean', 
  'American', 'French', 'Chinese', 'Japanese', 'Thai', 
  'Middle Eastern', 'Greek', 'Spanish', 'Korean', 'Vietnamese'
];

const MEAT_TYPES = [
  'Vegetarian', 'Vegan', 'Chicken', 'Beef', 'Pork', 
  'Fish', 'Seafood', 'Lamb', 'Turkey', 'Mixed'
];

const CreatePostComponent = ({ onPostCreated, currentUser }) => {
  const [postData, setPostData] = useState({
    title: '',
    description: '',
    ingredients: '',
    instructions: '',
    category: '',
    meatType: '',
    prepTimeHours: '',
    prepTimeMinutes: '',
    servings: '',
    image: null
  });

  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showMeatTypeModal, setShowMeatTypeModal] = useState(false);

  const validateForm = () => {
    const newErrors = {};

    if (!postData.title.trim()) newErrors.title = 'Recipe title is required';
    if (!postData.description.trim()) newErrors.description = 'Recipe description is required';
    if (!postData.ingredients.trim()) newErrors.ingredients = 'Ingredients list is required';
    if (!postData.instructions.trim()) newErrors.instructions = 'Cooking instructions are required';
    if (!postData.category) newErrors.category = 'Recipe category is required';
    if (!postData.meatType) newErrors.meatType = 'Meat type is required';
    if (!postData.servings.trim()) newErrors.servings = 'Number of servings is required';
    
    // Validate prep time (at least one should be filled)
    const hours = parseInt(postData.prepTimeHours) || 0;
    const minutes = parseInt(postData.prepTimeMinutes) || 0;
    if (hours === 0 && minutes === 0) {
      newErrors.prepTime = 'Preparation time is required';
    }

    // Validate servings is a number
    if (postData.servings && isNaN(parseInt(postData.servings))) {
      newErrors.servings = 'Servings must be a number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field, value) => {
    setPostData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert('Permission Required', 'Please allow access to your photo library to add images');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setPostData(prev => ({ ...prev, image: result.assets[0] }));
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setIsLoading(true);

    try {
      const totalMinutes = (parseInt(postData.prepTimeHours) || 0) * 60 + (parseInt(postData.prepTimeMinutes) || 0);
      
      const recipeData = {
        title: postData.title.trim(),
        description: postData.description.trim(),
        ingredients: postData.ingredients.trim(),
        instructions: postData.instructions.trim(),
        category: postData.category,
        meatType: postData.meatType,
        prepTime: totalMinutes,
        servings: parseInt(postData.servings),
        image: postData.image
      };

      const result = await recipeService.createRecipe(recipeData);

      if (result.success) {
        Alert.alert('Success', 'Recipe posted successfully!');
        onPostCreated(result.data);
        // Reset form
        setPostData({
          title: '', description: '', ingredients: '', instructions: '',
          category: '', meatType: '', prepTimeHours: '', prepTimeMinutes: '',
          servings: '', image: null
        });
      } else {
        Alert.alert('Error', result.message);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to post recipe. Please try again.');
    } finally {
      setIsLoading(false);
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

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.form}>
        {/* Recipe Title */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Recipe Title *</Text>
          <TextInput
            style={[styles.input, errors.title && styles.inputError]}
            value={postData.title}
            onChangeText={(text) => handleInputChange('title', text)}
            placeholder="Enter recipe title..."
            multiline={false}
          />
          {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}
        </View>

        {/* Recipe Description */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Description *</Text>
          <TextInput
            style={[styles.textArea, errors.description && styles.inputError]}
            value={postData.description}
            onChangeText={(text) => handleInputChange('description', text)}
            placeholder="Describe your recipe..."
            multiline
            numberOfLines={3}
          />
          {errors.description && <Text style={styles.errorText}>{errors.description}</Text>}
        </View>

        {/* Category and Meat Type Row */}
        <View style={styles.rowContainer}>
          <View style={styles.halfWidth}>
            <Text style={styles.label}>Category *</Text>
            <TouchableOpacity
              style={[styles.selector, errors.category && styles.inputError]}
              onPress={() => setShowCategoryModal(true)}
            >
              <Text style={postData.category ? styles.selectorText : styles.placeholderText}>
                {postData.category || 'Select category'}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#666" />
            </TouchableOpacity>
            {errors.category && <Text style={styles.errorText}>{errors.category}</Text>}
          </View>

          <View style={styles.halfWidth}>
            <Text style={styles.label}>Type *</Text>
            <TouchableOpacity
              style={[styles.selector, errors.meatType && styles.inputError]}
              onPress={() => setShowMeatTypeModal(true)}
            >
              <Text style={postData.meatType ? styles.selectorText : styles.placeholderText}>
                {postData.meatType || 'Select type'}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#666" />
            </TouchableOpacity>
            {errors.meatType && <Text style={styles.errorText}>{errors.meatType}</Text>}
          </View>
        </View>

        {/* Prep Time and Servings Row */}
        <View style={styles.rowContainer}>
          <View style={styles.halfWidth}>
            <Text style={styles.label}>Prep Time *</Text>
            <View style={styles.timeContainer}>
              <TextInput
                style={[styles.timeInput, errors.prepTime && styles.inputError]}
                value={postData.prepTimeHours}
                onChangeText={(text) => handleInputChange('prepTimeHours', text)}
                placeholder="0"
                keyboardType="numeric"
                maxLength={2}
              />
              <Text style={styles.timeLabel}>h</Text>
              <TextInput
                style={[styles.timeInput, errors.prepTime && styles.inputError]}
                value={postData.prepTimeMinutes}
                onChangeText={(text) => handleInputChange('prepTimeMinutes', text)}
                placeholder="0"
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
              value={postData.servings}
              onChangeText={(text) => handleInputChange('servings', text)}
              placeholder="4"
              keyboardType="numeric"
              maxLength={2}
            />
            {errors.servings && <Text style={styles.errorText}>{errors.servings}</Text>}
          </View>
        </View>

        {/* Ingredients */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Ingredients *</Text>
          <TextInput
            style={[styles.textArea, errors.ingredients && styles.inputError]}
            value={postData.ingredients}
            onChangeText={(text) => handleInputChange('ingredients', text)}
            placeholder="List all ingredients..."
            multiline
            numberOfLines={4}
          />
          {errors.ingredients && <Text style={styles.errorText}>{errors.ingredients}</Text>}
        </View>

        {/* Instructions */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Instructions *</Text>
          <TextInput
            style={[styles.textArea, errors.instructions && styles.inputError]}
            value={postData.instructions}
            onChangeText={(text) => handleInputChange('instructions', text)}
            placeholder="Step by step cooking instructions..."
            multiline
            numberOfLines={5}
          />
          {errors.instructions && <Text style={styles.errorText}>{errors.instructions}</Text>}
        </View>

        {/* Image Picker */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Recipe Image</Text>
          <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
            {postData.image ? (
              <View>
                <Image source={{ uri: postData.image.uri }} style={styles.selectedImage} />
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={() => setPostData(prev => ({ ...prev, image: null }))}
                >
                  <Ionicons name="close-circle" size={24} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.imagePickerPlaceholder}>
                <Ionicons name="camera-outline" size={40} color="#666" />
                <Text style={styles.imagePickerText}>Add Photo</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Post Recipe</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Category Modal */}
      <Modal
        visible={showCategoryModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Category</Text>
              <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>
            {renderModalList(RECIPE_CATEGORIES, (category) => {
              handleInputChange('category', category);
              setShowCategoryModal(false);
            }, postData.category)}
          </View>
        </View>
      </Modal>

      {/* Meat Type Modal */}
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
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>
            {renderModalList(MEAT_TYPES, (type) => {
              handleInputChange('meatType', type);
              setShowMeatTypeModal(false);
            }, postData.meatType)}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  form: {
    padding: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    textAlignVertical: 'top',
    minHeight: 80,
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    marginTop: 4,
  },
  rowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  halfWidth: {
    width: '48%',
  },
  selector: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  selectorText: {
    fontSize: 16,
    color: '#333',
  },
  placeholderText: {
    fontSize: 16,
    color: '#999',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    width: 50,
    textAlign: 'center',
  },
  timeLabel: {
    fontSize: 16,
    color: '#666',
    marginHorizontal: 8,
  },
  imagePicker: {
    borderWidth: 2,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9f9f9',
  },
  imagePickerPlaceholder: {
    alignItems: 'center',
  },
  imagePickerText: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
  },
  selectedImage: {
    width: 200,
    height: 150,
    borderRadius: 8,
  },
  removeImageButton: {
    position: 'absolute',
    top: -10,
    right: -10,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  submitButton: {
    backgroundColor: '#0866ff',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
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
    borderBottomColor: '#ddd',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalItemSelected: {
    backgroundColor: '#e3f2fd',
  },
  modalItemText: {
    fontSize: 16,
    color: '#333',
  },
  modalItemTextSelected: {
    color: '#0866ff',
    fontWeight: '600',
  },
});

export default CreatePostComponent;