import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Image,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

const CreatePostComponent = ({ onPostCreated }) => {
  const [postText, setPostText] = useState('');
  const [postImage, setPostImage] = useState(null);
  const [privacy, setPrivacy] = useState('friends'); 
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    setIsValid(postText.trim().length > 0 || postImage !== null);
  }, [postText, postImage]);

  const pickImage = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'We need camera roll permission to upload images.');
        return;
      }
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: [ImagePicker.MediaType.Images],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setPostImage(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'We need camera permission to take photos.');
        return;
      }
    }

    let result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setPostImage(result.assets[0].uri);
    }
  };

  const removeImage = () => {
    setPostImage(null);
  };

  const handlePrivacyChange = (newPrivacy) => {
    setPrivacy(newPrivacy);
  };

  const createPost = () => {
    if (!isValid) return;

    const newPost = {
      id: Date.now().toString(),
      text: postText,
      image: postImage,
      privacy: privacy,
      createdAt: new Date().toISOString(),
      likes: 0,
      comments: [],
    };

    if (onPostCreated) {
      onPostCreated(newPost);
    }

    setPostText('');
    setPostImage(null);
    setPrivacy('friends');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Create New Post</Text>
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Post Text Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            placeholder="What's on your mind?"
            value={postText}
            onChangeText={setPostText}
            multiline
            numberOfLines={5}
          />
        </View>

        {/* Image Preview */}
        {postImage && (
          <View style={styles.imagePreviewContainer}>
            <Image source={{ uri: postImage }} style={styles.imagePreview} />
            <TouchableOpacity 
              style={styles.removeImageButton} 
              onPress={removeImage}
            >
              <Ionicons name="close-circle" size={24} color="white" />
            </TouchableOpacity>
          </View>
        )}

        {/* Media Actions */}
        <View style={styles.mediaActions}>
          <TouchableOpacity style={styles.mediaButton} onPress={pickImage}>
            <Ionicons name="image-outline" size={22} color="#075eec" />
            <Text style={styles.mediaButtonText}>Gallery</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.mediaButton} onPress={takePhoto}>
            <Ionicons name="camera-outline" size={22} color="#075eec" />
            <Text style={styles.mediaButtonText}>Camera</Text>
          </TouchableOpacity>
        </View>

        {/* Privacy Settings */}
        <View style={styles.privacyContainer}>
          <Text style={styles.sectionTitle}>Who can see your post?</Text>
          
          <View style={styles.privacyOptions}>
            <TouchableOpacity 
              style={[
                styles.privacyOption, 
                privacy === 'public' && styles.privacyOptionSelected
              ]}
              onPress={() => handlePrivacyChange('public')}
            >
              <Ionicons 
                name="globe-outline" 
                size={20} 
                color={privacy === 'public' ? "#075eec" : "#666"} 
              />
              <Text style={[
                styles.privacyOptionText,
                privacy === 'public' && styles.privacyOptionTextSelected
              ]}>Public</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.privacyOption, 
                privacy === 'friends' && styles.privacyOptionSelected
              ]}
              onPress={() => handlePrivacyChange('friends')}
            >
              <Ionicons 
                name="people-outline" 
                size={20} 
                color={privacy === 'friends' ? "#075eec" : "#666"} 
              />
              <Text style={[
                styles.privacyOptionText,
                privacy === 'friends' && styles.privacyOptionTextSelected
              ]}>Friends</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.privacyOption, 
                privacy === 'private' && styles.privacyOptionSelected
              ]}
              onPress={() => handlePrivacyChange('private')}
            >
              <Ionicons 
                name="lock-closed-outline" 
                size={20} 
                color={privacy === 'private' ? "#075eec" : "#666"} 
              />
              <Text style={[
                styles.privacyOptionText,
                privacy === 'private' && styles.privacyOptionTextSelected
              ]}>Only Me</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.postButton, !isValid && styles.postButtonDisabled]}
          onPress={createPost}
          disabled={!isValid}
        >
          <Text style={styles.postButtonText}>Post</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e1e1e1',
    marginBottom: 20,
  },
  header: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e1e1',
  },
  headerText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  scrollView: {
    maxHeight: 500,
  },
  inputContainer: {
    padding: 15,
  },
  textInput: {
    minHeight: 100,
    fontSize: 16,
    color: '#333',
    textAlignVertical: 'top',
  },
  imagePreviewContainer: {
    position: 'relative',
    margin: 15,
    marginTop: 0,
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },
  removeImageButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 15,
  },
  mediaActions: {
    flexDirection: 'row',
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#e1e1e1',
  },
  mediaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
    padding: 8,
    borderRadius: 5,
    backgroundColor: '#f0f2f5',
  },
  mediaButtonText: {
    marginLeft: 5,
    fontSize: 14,
    color: '#075eec',
    fontWeight: '500',
  },
  privacyContainer: {
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#e1e1e1',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  privacyOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  privacyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#e1e1e1',
    flex: 1,
    marginHorizontal: 5,
    justifyContent: 'center',
  },
  privacyOptionSelected: {
    borderColor: '#075eec',
    backgroundColor: '#e6effd',
  },
  privacyOptionText: {
    marginLeft: 5,
    fontSize: 14,
    color: '#666',
  },
  privacyOptionTextSelected: {
    color: '#075eec',
    fontWeight: '500',
  },
  footer: {
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#e1e1e1',
  },
  postButton: {
    backgroundColor: '#075eec',
    borderRadius: 30,
    paddingVertical: 10,
    alignItems: 'center',
  },
  postButtonDisabled: {
    backgroundColor: '#a9c0e9',
  },
  postButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default CreatePostComponent;