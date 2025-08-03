import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  SafeAreaView
} from 'react-native';
import { Video } from 'expo-av'; // 🆕 הוסף אימפורט לוידאו

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

const SimpleIcon = ({ type, size = 24, color = FLAVORWORLD_COLORS.text }) => {
  const icons = {
    close: '✕',
    check: '✓',
    circle: '○',
    search: '🔍'
  };
  
  return (
    <Text style={{ fontSize: size, color, fontWeight: 'bold' }}>
      {icons[type] || '●'}
    </Text>
  );
};

const SharePostComponent = ({ 
  visible, 
  onClose, 
  post, 
  onShare, 
  currentUserId 
}) => {
  const [friends, setFriends] = useState([]);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [filteredFriends, setFilteredFriends] = useState([]);

  useEffect(() => {
    const fetchFriends = async () => {
      setTimeout(() => {
        const realFriends = [];
        
        setFriends(realFriends);
        setFilteredFriends(realFriends);
        setLoading(false);
      }, 500);
    };

    if (visible) {
      fetchFriends();
    }
  }, [visible]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredFriends(friends);
    } else {
      const filtered = friends.filter(friend => 
        friend.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredFriends(filtered);
    }
  }, [searchQuery, friends]);

  const toggleFriendSelection = (friendId) => {
    if (selectedFriends.includes(friendId)) {
      setSelectedFriends(selectedFriends.filter(id => id !== friendId));
    } else {
      setSelectedFriends([...selectedFriends, friendId]);
    }
  };

  const selectAllFriends = () => {
    if (selectedFriends.length === filteredFriends.length) {
      setSelectedFriends([]);
    } else {
      setSelectedFriends(filteredFriends.map(friend => friend.id));
    }
  };

  const handleShare = () => {
    if (selectedFriends.length === 0) {
      Alert.alert('No Friends Selected', 'Please select at least one friend to share this delicious recipe with!');
      return;
    }

    if (post?.privacy === 'private' && post?.userId !== currentUserId) {
      Alert.alert('Cannot Share', 'This recipe is private and cannot be shared.');
      return;
    }

    const shareData = {
      postId: post?.id || post?._id,
      recipients: selectedFriends,
      message: message,
      sharedAt: new Date().toISOString(),
      sharedBy: currentUserId
    };

    if (onShare) {
      onShare(shareData);
    }

    setSelectedFriends([]);
    setMessage('');
    
    if (onClose) {
      onClose();
    }

    Alert.alert('Recipe Shared! ', 'Your delicious recipe has been shared successfully!');
  };
  
  const renderFriendItem = ({ item }) => (
    <TouchableOpacity 
      style={[
        styles.friendItem,
        selectedFriends.includes(item.id) && styles.selectedFriendItem
      ]}
      onPress={() => toggleFriendSelection(item.id)}
    >
      <View style={styles.friendInfo}>
        <Image source={{ uri: item.avatar }} style={styles.friendAvatar} />
        <Text style={styles.friendName}>{item.name}</Text>
      </View>
      
      <View style={styles.rightSection}>
        {item.status === 'online' && (
          <View style={styles.onlineIndicator} />
        )}
        <SimpleIcon 
          type={selectedFriends.includes(item.id) ? "check" : "circle"} 
          size={24} 
          color={selectedFriends.includes(item.id) ? FLAVORWORLD_COLORS.primary : FLAVORWORLD_COLORS.border} 
        />
      </View>
    </TouchableOpacity>
  );

  // 🆕 פונקציה מעודכנת עם תמיכה בוידאו
  const renderPostPreview = () => {
    if (!post) {
      return (
        <View style={styles.postPreview}>
          <Text style={styles.previewTitle}>No Recipe Selected</Text>
        </View>
      );
    }

    // 🆕 זיהוי סוג מדיה
    const hasImage = post.image;
    const hasVideo = post.video;
    const mediaType = post.mediaType || (hasImage ? 'image' : hasVideo ? 'video' : 'none');

    return (
      <View style={styles.postPreview}>
        <View style={styles.previewHeader}>
          <Text style={styles.previewTitle}>🍳 Recipe Preview</Text>
        </View>
        <View style={styles.previewContent}>
          {/* 🆕 הצגת מדיה - תמונה או וידאו */}
          {(mediaType === 'image' || hasImage) && (
            <Image source={{ uri: post.image }} style={styles.previewImage} />
          )}
          
          {(mediaType === 'video' || hasVideo) && (
            <View style={styles.previewVideoContainer}>
              <Video
                source={{ uri: post.video }}
                rate={1.0}
                volume={0}
                isMuted={true}
                resizeMode="cover"
                shouldPlay={false}
                isLooping={false}
                style={styles.previewVideo}
              />
              <View style={styles.videoPreviewOverlay}>
                <Text style={styles.videoPlayIcon}>▶️</Text>
              </View>
            </View>
          )}
          
          <View style={styles.previewTextContainer}>
            <Text numberOfLines={1} style={styles.previewRecipeTitle}>
              {post.title || 'Untitled Recipe'}
            </Text>
            <Text numberOfLines={2} style={styles.previewText}>
              {post.description || post.text || 'No description available'}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <SimpleIcon type="close" size={24} color={FLAVORWORLD_COLORS.accent} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Share Recipe</Text>
          <TouchableOpacity 
            onPress={handleShare} 
            disabled={selectedFriends.length === 0}
            style={[
              styles.shareButton,
              selectedFriends.length === 0 && styles.disabledButton
            ]}
          >
            <Text style={[
              styles.shareButtonText,
              selectedFriends.length === 0 && styles.disabledButtonText
            ]}>Share</Text>
          </TouchableOpacity>
        </View>

        {/* Recipe Preview */}
        {renderPostPreview()}

        {/* Message Input */}
        <View style={styles.messageContainer}>
          <TextInput
            style={styles.messageInput}
            placeholder="Add a personal message with this recipe..."
            placeholderTextColor={FLAVORWORLD_COLORS.textLight}
            value={message}
            onChangeText={setMessage}
            multiline
            maxLength={200}
          />
        </View>

        {/* Friends List */}
        <View style={styles.friendsContainer}>
          <View style={styles.friendsHeader}>
            <Text style={styles.sectionTitle}>Share with Friends</Text>
            <TouchableOpacity onPress={selectAllFriends}>
              <Text style={styles.selectAllText}>
                {selectedFriends.length === filteredFriends.length 
                  ? "Deselect All" 
                  : "Select All"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={styles.searchContainer}>
            <SimpleIcon type="search" size={20} color={FLAVORWORLD_COLORS.textLight} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search friends..."
              placeholderTextColor={FLAVORWORLD_COLORS.textLight}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Friends List or Loading */}
          {loading ? (
            <ActivityIndicator size="large" color={FLAVORWORLD_COLORS.primary} style={styles.loader} />
          ) : (
            <FlatList
              data={filteredFriends}
              keyExtractor={(item) => item.id}
              renderItem={renderFriendItem}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyIcon}>👥</Text>
                  <Text style={styles.emptyText}>
                    {searchQuery ? "No friends match your search" : "You don't have any friends yet"}
                  </Text>
                  <Text style={styles.emptySubText}>
                    {!searchQuery && "Add friends to start sharing delicious recipes with them!"}
                  </Text>
                </View>
              }
            />
          )}
        </View>

        {/* Selection Counter */}
        {selectedFriends.length > 0 && (
          <View style={styles.selectionCounter}>
            <Text style={styles.counterText}>
              {selectedFriends.length} {selectedFriends.length === 1 ? 'friend' : 'friends'} selected
            </Text>
          </View>
        )}
      </SafeAreaView>
    </Modal>
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
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: FLAVORWORLD_COLORS.border,
    backgroundColor: FLAVORWORLD_COLORS.white,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: FLAVORWORLD_COLORS.text,
  },
  closeButton: {
    padding: 8,
    backgroundColor: FLAVORWORLD_COLORS.background,
    borderRadius: 20,
  },
  shareButton: {
    backgroundColor: FLAVORWORLD_COLORS.primary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  shareButtonText: {
    color: FLAVORWORLD_COLORS.white,
    fontWeight: '600',
    fontSize: 14,
  },
  disabledButton: {
    backgroundColor: FLAVORWORLD_COLORS.border,
  },
  disabledButtonText: {
    color: FLAVORWORLD_COLORS.textLight,
  },
  postPreview: {
    borderBottomWidth: 1,
    borderBottomColor: FLAVORWORLD_COLORS.border,
    padding: 15,
    backgroundColor: FLAVORWORLD_COLORS.white,
  },
  previewHeader: {
    marginBottom: 10,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: FLAVORWORLD_COLORS.text,
  },
  previewContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  // 🆕 סטיילים חדשים לוידאו
  previewVideoContainer: {
    position: 'relative',
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
    overflow: 'hidden',
  },
  previewVideo: {
    width: '100%',
    height: '100%',
  },
  videoPreviewOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPlayIcon: {
    fontSize: 16,
  },
  previewTextContainer: {
    flex: 1,
  },
  previewRecipeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: FLAVORWORLD_COLORS.text,
    marginBottom: 4,
  },
  previewText: {
    fontSize: 14,
    color: FLAVORWORLD_COLORS.textLight,
    lineHeight: 18,
  },
  messageContainer: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: FLAVORWORLD_COLORS.border,
    backgroundColor: FLAVORWORLD_COLORS.white,
  },
  messageInput: {
    fontSize: 15,
    minHeight: 40,
    maxHeight: 80,
    borderWidth: 2,
    borderColor: FLAVORWORLD_COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 8,
    textAlignVertical: 'top',
    backgroundColor: FLAVORWORLD_COLORS.background,
    color: FLAVORWORLD_COLORS.text,
  },
  friendsContainer: {
    flex: 1,
    padding: 15,
    backgroundColor: FLAVORWORLD_COLORS.white,
  },
  friendsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: FLAVORWORLD_COLORS.text,
  },
  selectAllText: {
    fontSize: 14,
    color: FLAVORWORLD_COLORS.secondary,
    fontWeight: '500',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: FLAVORWORLD_COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: FLAVORWORLD_COLORS.border,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    marginLeft: 10,
    color: FLAVORWORLD_COLORS.text,
  },
  friendItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: FLAVORWORLD_COLORS.border,
  },
  selectedFriendItem: {
    backgroundColor: FLAVORWORLD_COLORS.background,
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  friendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  friendAvatar: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    marginRight: 12,
    borderWidth: 2,
    borderColor: FLAVORWORLD_COLORS.primary,
  },
  friendName: {
    fontSize: 15,
    fontWeight: '500',
    color: FLAVORWORLD_COLORS.text,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  onlineIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: FLAVORWORLD_COLORS.success,
    marginRight: 10,
  },
  loader: {
    marginTop: 40,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60,
    paddingHorizontal: 20,
  },
  emptyIcon: {
    fontSize: 60,
    marginBottom: 16,
    opacity: 0.5,
  },
  emptyText: {
    textAlign: 'center',
    color: FLAVORWORLD_COLORS.textLight,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubText: {
    textAlign: 'center',
    color: FLAVORWORLD_COLORS.textLight,
    fontSize: 14,
    lineHeight: 20,
  },
  selectionCounter: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
    backgroundColor: FLAVORWORLD_COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  counterText: {
    color: FLAVORWORLD_COLORS.white,
    fontWeight: '600',
    fontSize: 14,
  },
});

export default SharePostComponent;