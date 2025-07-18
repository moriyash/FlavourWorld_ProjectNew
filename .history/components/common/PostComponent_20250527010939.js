import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const PostComponent = ({ 
  post, 
  onDelete, 
  onUpdate, 
  onShare, 
  currentUser,
  navigation 
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editedText, setEditedText] = useState(post.text);

  const isAuthor = currentUser && currentUser.id === post.userId;

  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  const getPrivacyIcon = () => {
    switch (post.privacy) {
      case 'public':
        return <Ionicons name="globe-outline" size={16} color="#666" />;
      case 'friends':
        return <Ionicons name="people-outline" size={16} color="#666" />;
      case 'private':
        return <Ionicons name="lock-closed-outline" size={16} color="#666" />;
      default:
        return null;
    }
  };

  const handleEditSave = () => {
    if (editedText.trim() === '') {
      Alert.alert('Error', 'Post text cannot be empty');
      return;
    }

    const updatedPost = {
      ...post,
      text: editedText,
      editedAt: new Date().toISOString()
    };

    if (onUpdate) {
      onUpdate(updatedPost);
    }

    setEditMode(false);
    setOptionsVisible(false);
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post? This cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          onPress: () => {
            if (onDelete) {
              onDelete(post.id);
            }
            setOptionsVisible(false);
          },
          style: 'destructive',
        },
      ]
    );
  };

  const handleShare = () => {
    if (onShare) {
      onShare(post);
    }
    setOptionsVisible(false);
  };

  const navigateToPostDetails = () => {
    if (navigation) {
      navigation.navigate('PostDetails', { postId: post.id });
    }
  };

  return (
    <View style={styles.container}>
      {/* Post Header */}
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <Image
            source={{ uri: post.userAvatar || 'https://via.placeholder.com/40' }}
            style={styles.avatar}
          />
          <View>
            <Text style={styles.userName}>{post.userName}</Text>
            <View style={styles.postMetadata}>
              <Text style={styles.postDate}>{formatDate(post.createdAt)}</Text>
              <View style={styles.privacyIndicator}>
                {getPrivacyIcon()}
                <Text style={styles.privacyText}>
                  {post.privacy.charAt(0).toUpperCase() + post.privacy.slice(1)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Post Options Button (for author only) */}
        {isAuthor && (
          <TouchableOpacity
            style={styles.optionsButton}
            onPress={() => setOptionsVisible(!optionsVisible)}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color="#666" />
          </TouchableOpacity>
        )}
      </View>

      {/* Post Content */}
      <TouchableOpacity 
        style={styles.contentContainer}
        onPress={navigateToPostDetails}
        activeOpacity={0.9}
      >
        {/* Post Text */}
        {editMode ? (
          <TextInput
            style={styles.editTextInput}
            value={editedText}
            onChangeText={setEditedText}
            multiline
            numberOfLines={5}
            placeholder="Edit your post..."
          />
        ) : (
          <Text style={styles.postText}>{post.text}</Text>
        )}

        {/* Post Image (if available) */}
        {post.image && (
          <TouchableOpacity 
            onPress={() => setModalVisible(true)}
            activeOpacity={0.9}
          >
            <Image
              source={{ uri: post.image }}
              style={styles.postImage}
              resizeMode="cover"
            />
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      {/* Post Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.stat}>
          <Ionicons name="heart-outline" size={18} color="#666" />
          <Text style={styles.statText}>{post.likes} Likes</Text>
        </View>
        <View style={styles.stat}>
          <Ionicons name="chatbubble-outline" size={18} color="#666" />
          <Text style={styles.statText}>{post.comments?.length || 0} Comments</Text>
        </View>
      </View>

      {/* Post Actions */}
      <View style={styles.actionsContainer}>
        {/* Like Button */}
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="heart-outline" size={22} color="#666" />
          <Text style={styles.actionText}>Like</Text>
        </TouchableOpacity>

        {/* Comment Button */}
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={navigateToPostDetails}
        >
          <Ionicons name="chatbubble-outline" size={22} color="#666" />
          <Text style={styles.actionText}>Comment</Text>
        </TouchableOpacity>

        {/* Share Button */}
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={handleShare}
        >
          <Ionicons name="arrow-redo-outline" size={22} color="#666" />
          <Text style={styles.actionText}>Share</Text>
        </TouchableOpacity>
      </View>

      {/* Edit/Delete Options Modal */}
      {optionsVisible && (
        <View style={styles.optionsMenu}>
          {editMode ? (
            <View style={styles.editActions}>
              <TouchableOpacity 
                style={styles.editButton}
                onPress={handleEditSave}
              >
                <Text style={styles.editButtonText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.editButton, styles.cancelButton]}
                onPress={() => {
                  setEditMode(false);
                  setEditedText(post.text);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TouchableOpacity 
                style={styles.optionItem}
                onPress={() => {
                  setEditMode(true);
                  setOptionsVisible(false);
                }}
              >
                <Ionicons name="create-outline" size={20} color="#333" />
                <Text style={styles.optionText}>Edit Post</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.optionItem}
                onPress={handleDelete}
              >
                <Ionicons name="trash-outline" size={20} color="#ff3b30" />
                <Text style={[styles.optionText, { color: '#ff3b30' }]}>Delete Post</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.optionItem}
                onPress={() => setOptionsVisible(false)}
              >
                <Ionicons name="close-outline" size={20} color="#333" />
                <Text style={styles.optionText}>Cancel</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      {/* Full Screen Image Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity 
            style={styles.closeButton} 
            onPress={() => setModalVisible(false)}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <Image
            source={{ uri: post.image }}
            style={styles.fullImage}
            resizeMode="contain"
          />
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e1e1e1',
    marginBottom: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  postMetadata: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  postDate: {
    fontSize: 12,
    color: '#666',
  },
  privacyIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    backgroundColor: '#f0f2f5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  privacyText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 3,
  },
  optionsButton: {
    padding: 5,
  },
  contentContainer: {
    padding: 12,
  },
  postText: {
    fontSize: 15,
    color: '#333',
    marginBottom: 12,
    lineHeight: 20,
  },
  editTextInput: {
    fontSize: 15,
    color: '#333',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 10,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  postImage: {
    width: '100%',
    height: 300,
    borderRadius: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#e1e1e1',
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  statText: {
    fontSize: 13,
    color: '#666',
    marginLeft: 4,
  },
  actionsContainer: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#e1e1e1',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  actionText: {
    marginLeft: 5,
    fontSize: 14,
    color: '#666',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
  },
  fullImage: {
    width: '100%',
    height: '80%',
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: 5,
  },
  optionsMenu: {
    position: 'absolute',
    top: 50,
    right: 15,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 2,
    borderWidth: 1,
    borderColor: '#e1e1e1',
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e1e1',
  },
  optionText: {
    marginLeft: 10,
    fontSize: 14,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 5,
  },
  editButton: {
    backgroundColor: '#075eec',
    padding: 8,
    borderRadius: 5,
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#f0f2f5',
  },
  editButtonText: {
    color: '#fff',
    fontWeight: '500',
  },
  cancelButtonText: {
    color: '#333',
    fontWeight: '500',
  },
});

export default PostComponent;