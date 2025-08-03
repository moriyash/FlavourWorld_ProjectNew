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
import { Video } from 'expo-av';
import { useAuth } from '../../../services/AuthContext';
import { chatService } from '../../../services/chatServices';
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
  const { currentUser } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [filteredContacts, setFilteredContacts] = useState([]);

  useEffect(() => {
    const fetchContacts = async () => {
      if (!visible) return;
      
      setLoading(true);
      try {
        console.log('Loading contacts for sharing...');
        
        // טוען צ'אטים קיימים
        const chatsResult = await chatService.getAllChats();
        let chatContacts = [];
        
        if (chatsResult.success && chatsResult.data) {
          chatContacts = chatsResult.data
            .filter(chat => chat.chatType === 'private' && chat.participants?.length >= 2)
            .map(chat => {
              const otherUser = chat.participants.find(p => 
                p.userId !== (currentUser?.id || currentUser?._id)
              );
              
              if (otherUser) {
                return {
                  id: otherUser.userId,
                  name: otherUser.userName,
                  avatar: otherUser.userAvatar,
                  source: 'chat',
                  isOnline: true, // 🔥 תמיד מחובר לצורך השיתוף
                  chatId: chat._id,
                  lastActive: chat.updatedAt
                };
              }
              return null;
            })
            .filter(contact => contact !== null);
        }

        // טוען רשימת עוקבים
        let followingContacts = [];
        try {
          const followingResult = await userService.getFollowingList(currentUser?.id || currentUser?._id);
          
          if (followingResult.success && followingResult.data) {
            followingContacts = followingResult.data.map(user => ({
              id: user.id || user._id,
              name: user.fullName || user.name,
              avatar: user.avatar || user.userAvatar,
              source: 'following',
              isOnline: true, // 🔥 תמיד מחובר לצורך השיתוף
              chatId: null, // יצור צ'אט חדש אם צריך
              lastActive: user.lastActive
            }));
          }
        } catch (followingError) {
          console.log('Could not load following list:', followingError);
        }

        // מיזוג הרשימות ומניעת כפילויות
        const allContacts = [...chatContacts];
        
        followingContacts.forEach(followingContact => {
          const existsInChats = chatContacts.some(chatContact => 
            chatContact.id === followingContact.id
          );
          
          if (!existsInChats) {
            allContacts.push(followingContact);
          } else {
            // עדכון פרטי ליצירת קשר אם הוא כבר קיים בצ'אטים
            const existingIndex = allContacts.findIndex(contact => contact.id === followingContact.id);
            if (existingIndex !== -1) {
              allContacts[existingIndex] = {
                ...allContacts[existingIndex],
                source: 'both' // מציין שהוא גם בצ'אטים וגם ברשימת עוקבים
              };
            }
          }
        });

        // מיון לפי פעילות אחרונה
        const sortedContacts = allContacts.sort((a, b) => {
          const aTime = new Date(a.lastActive || '2000-01-01');
          const bTime = new Date(b.lastActive || '2000-01-01');
          return bTime - aTime;
        });

        console.log(`Loaded ${sortedContacts.length} contacts for sharing`);
        console.log(`- From chats: ${chatContacts.length}`);
        console.log(`- From following: ${followingContacts.length}`);
        
        setContacts(sortedContacts);
        setFilteredContacts(sortedContacts);
        
      } catch (error) {
        console.error('Error loading contacts:', error);
        Alert.alert('Error', 'Failed to load contacts for sharing');
      } finally {
        setLoading(false);
      }
    };

    fetchContacts();
  }, [visible, currentUser]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredContacts(contacts);
    } else {
      const filtered = contacts.filter(contact => 
        contact.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredContacts(filtered);
    }
  }, [searchQuery, contacts]);

  const toggleContactSelection = (contactId) => {
    if (selectedContacts.includes(contactId)) {
      setSelectedContacts(selectedContacts.filter(id => id !== contactId));
    } else {
      setSelectedContacts([...selectedContacts, contactId]);
    }
  };

  const selectAllContacts = () => {
    if (selectedContacts.length === filteredContacts.length) {
      setSelectedContacts([]);
    } else {
      setSelectedContacts(filteredContacts.map(contact => contact.id));
    }
  };

  const handleShare = async () => {
    if (selectedContacts.length === 0) {
      Alert.alert('No Contacts Selected', 'Please select at least one person to share this delicious recipe with!');
      return;
    }

    if (post?.privacy === 'private' && post?.userId !== currentUserId) {
      Alert.alert('Cannot Share', 'This recipe is private and cannot be shared.');
      return;
    }

    console.log('🔄 Starting share process...');
    setLoading(true);
    
    try {
      const selectedContactsData = contacts.filter(contact => 
        selectedContacts.includes(contact.id)
      );

      let successCount = 0;
      let failCount = 0;

      for (const contact of selectedContactsData) {
        try {
          console.log(`📤 Sharing with ${contact.name}...`);
          let chatId = contact.chatId;
          
          // אם אין צ'אט קיים, יוצר חדש
          if (!chatId) {
            console.log(`🆕 Creating new chat with ${contact.name}`);
            const createChatResult = await chatService.getOrCreatePrivateChat(contact.id);
            
            if (createChatResult.success) {
              chatId = createChatResult.data._id;
              console.log(`✅ Chat created successfully: ${chatId}`);
            } else {
              console.error(`❌ Failed to create chat with ${contact.name}:`, createChatResult.message);
              failCount++;
              continue;
            }
          }

          // שולח הודעה עם הפוסט
          const shareMessage = {
            chatId: chatId,
            content: message || `Check out this amazing recipe: ${post?.title || 'Delicious Recipe'}!`,
            messageType: 'shared_post',
            sharedPost: {
              postId: post?.id || post?._id,
              title: post?.title,
              description: post?.description || post?.text,
              image: post?.image,
              video: post?.video,
              mediaType: post?.mediaType,
              authorName: post?.user?.fullName || post?.user?.name || post?.userName || 'Unknown Chef',
              authorAvatar: post?.user?.avatar || post?.userAvatar
            }
          };

          console.log(`📨 Sending message to chat ${chatId}...`);
          const sendResult = await chatService.sendMessage(shareMessage);
          
          if (sendResult.success) {
            console.log(`✅ Successfully shared with ${contact.name}`);
            successCount++;
          } else {
            console.error(`❌ Failed to share with ${contact.name}:`, sendResult.message);
            failCount++;
          }
          
        } catch (contactError) {
          console.error(`❌ Error sharing with ${contact.name}:`, contactError);
          failCount++;
        }
      }

      // קריאה חזרה למידע שיתוף רגיל
      if (onShare) {
        const shareData = {
          postId: post?.id || post?._id,
          recipients: selectedContacts,
          message: message,
          sharedAt: new Date().toISOString(),
          sharedBy: currentUserId,
          shareMethod: 'direct_message'
        };
        
        onShare(shareData);
      }

      setSelectedContacts([]);
      setMessage('');
      
      if (onClose) {
        onClose();
      }

      // הודעת סיכום
      if (successCount > 0 && failCount === 0) {
        Alert.alert(
          'Recipe Shared! 🍳', 
          `Your delicious recipe has been shared with ${successCount} ${successCount === 1 ? 'person' : 'people'}!`
        );
      } else if (successCount > 0 && failCount > 0) {
        Alert.alert(
          'Partially Shared', 
          `Recipe shared with ${successCount} contacts, but failed to send to ${failCount} contacts.`
        );
      } else {
        Alert.alert('Share Failed', 'Failed to share recipe with selected contacts. Please try again.');
      }
      
    } catch (error) {
      console.error('❌ Error sharing recipe:', error);
      Alert.alert('Error', 'Failed to share recipe. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const renderContactItem = ({ item }) => (
    <TouchableOpacity 
      style={[
        styles.contactItem,
        selectedContacts.includes(item.id) && styles.selectedContactItem
      ]}
      onPress={() => toggleContactSelection(item.id)}
    >
      <View style={styles.contactInfo}>
        <View style={styles.avatarContainer}>
          <Image source={{ uri: item.avatar }} style={styles.contactAvatar} />
          {/* 🔥 הסרת אינדיקטור מחובר */}
        </View>
        
        <View style={styles.contactDetails}>
          <Text style={styles.contactName}>{item.name}</Text>
          <View style={styles.contactMeta}>
            {item.source === 'chat' && (
              <Text style={styles.sourceLabel}>💬 Chat</Text>
            )}
            {item.source === 'following' && (
              <Text style={styles.sourceLabel}>👥 Following</Text>
            )}
            {item.source === 'both' && (
              <Text style={styles.sourceLabel}>💬👥 Chat & Following</Text>
            )}
          </View>
        </View>
      </View>
      
      <SimpleIcon 
        type={selectedContacts.includes(item.id) ? "check" : "circle"} 
        size={24} 
        color={selectedContacts.includes(item.id) ? FLAVORWORLD_COLORS.primary : FLAVORWORLD_COLORS.border} 
      />
    </TouchableOpacity>
  );

  const renderPostPreview = () => {
    if (!post) {
      return (
        <View style={styles.postPreview}>
          <Text style={styles.previewTitle}>No Recipe Selected</Text>
        </View>
      );
    }

    const hasImage = post.image;
    const hasVideo = post.video;
    const mediaType = post.mediaType || (hasImage ? 'image' : hasVideo ? 'video' : 'none');

    return (
      <View style={styles.postPreview}>
        <View style={styles.previewHeader}>
          <Text style={styles.previewTitle}>🍳 Recipe Preview</Text>
        </View>
        <View style={styles.previewContent}>
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
            disabled={selectedContacts.length === 0 || loading}
            style={[
              styles.shareButton,
              (selectedContacts.length === 0 || loading) && styles.disabledButton
            ]}
          >
            {loading ? (
              <ActivityIndicator size="small" color={FLAVORWORLD_COLORS.white} />
            ) : (
              <Text style={[
                styles.shareButtonText,
                selectedContacts.length === 0 && styles.disabledButtonText
              ]}>Share</Text>
            )}
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
            editable={!loading}
          />
        </View>

        {/* Contacts List */}
        <View style={styles.contactsContainer}>
          <View style={styles.contactsHeader}>
            <Text style={styles.sectionTitle}>
              Share with Contacts ({contacts.length})
            </Text>
            <TouchableOpacity onPress={selectAllContacts} disabled={loading}>
              <Text style={[
                styles.selectAllText,
                loading && styles.disabledText
              ]}>
                {selectedContacts.length === filteredContacts.length 
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
              placeholder="Search contacts..."
              placeholderTextColor={FLAVORWORLD_COLORS.textLight}
              value={searchQuery}
              onChangeText={setSearchQuery}
              editable={!loading}
            />
          </View>

          {/* Contacts List or Loading */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={FLAVORWORLD_COLORS.primary} />
              <Text style={styles.loadingText}>Loading your contacts...</Text>
            </View>
          ) : (
            <FlatList
              data={filteredContacts}
              keyExtractor={(item) => item.id}
              renderItem={renderContactItem}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyIcon}>👥</Text>
                  <Text style={styles.emptyText}>
                    {searchQuery 
                      ? "No contacts match your search" 
                      : "No contacts available"}
                  </Text>
                  <Text style={styles.emptySubText}>
                    {!searchQuery && "Start chatting with people or follow users to share recipes with them!"}
                  </Text>
                </View>
              }
            />
          )}
        </View>

        {/* Selection Counter */}
        {selectedContacts.length > 0 && !loading && (
          <View style={styles.selectionCounter}>
            <Text style={styles.counterText}>
              {selectedContacts.length} {selectedContacts.length === 1 ? 'contact' : 'contacts'} selected
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
    minWidth: 70,
    alignItems: 'center',
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
  disabledText: {
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
  contactsContainer: {
    flex: 1,
    padding: 15,
    backgroundColor: FLAVORWORLD_COLORS.white,
  },
  contactsHeader: {
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
  contactItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: FLAVORWORLD_COLORS.border,
  },
  selectedContactItem: {
    backgroundColor: FLAVORWORLD_COLORS.background,
    borderRadius: 8,
  },
  contactInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  contactAvatar: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    borderWidth: 2,
    borderColor: FLAVORWORLD_COLORS.primary,
  },
  contactDetails: {
    flex: 1,
  },
  contactName: {
    fontSize: 15,
    fontWeight: '500',
    color: FLAVORWORLD_COLORS.text,
    marginBottom: 2,
  },
  contactMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sourceLabel: {
    fontSize: 12,
    color: FLAVORWORLD_COLORS.textLight,
    backgroundColor: FLAVORWORLD_COLORS.background,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: FLAVORWORLD_COLORS.textLight,
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