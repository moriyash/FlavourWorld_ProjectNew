import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Image,
  Modal,
  Dimensions,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useAuth } from '../../../services/AuthContext';
import UserAvatar from '../../common/UserAvatar';
import { chatService } from '../../../services/chatServices';

const { width: screenWidth } = Dimensions.get('window');

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

const ChatConversationScreen = ({ route, navigation }) => {
  const { currentUser } = useAuth();
  const { chatId, otherUser } = route.params;
  
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showAttachments, setShowAttachments] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [modalImage, setModalImage] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  
  const flatListRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const attachmentSlideAnim = useRef(new Animated.Value(0)).current;

  // Chat service 
  useEffect(() => {
    chatService.joinChat(chatId, 'private');
    
    const unsubscribeMessage = chatService.onMessage((newMessage) => {
      if (newMessage.chatId === chatId) {
        setMessages(prevMessages => [...prevMessages, newMessage]);
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    });

    const unsubscribeTyping = chatService.onTyping((data) => {
      if (data.chatId === chatId && data.userId !== (currentUser?.id || currentUser?._id)) {
        if (data.type === 'start') {
          setOtherUserTyping(true);
        } else if (data.type === 'stop') {
          setOtherUserTyping(false);
        }
      }
    });

    const socket = chatService.getSocket();
    if (socket) {
      socket.on('messages_loaded', (messagesData) => {
        if (messagesData.chatId === chatId) {
          setMessages(messagesData.messages || []);
          setLoading(false);
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: false });
          }, 100);
        }
      });

      socket.on('messages_marked_read', (data) => {
        if (data.chatId === chatId) {
          setMessages(prevMessages => 
            prevMessages.map(msg => 
              msg._id === data.messageId 
                ? { ...msg, readBy: data.readBy }
                : msg
            )
          );
        }
      });
     
      socket.on('message_received', (newMessage) => {
        console.log(' Real-time message received:', newMessage);
          if (newMessage.chatId === chatId) {
            setMessages(prevMessages => [...prevMessages, newMessage]);
           setTimeout(() => {
              flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }
});
    }

    loadMessages();

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      chatService.leaveChat(chatId, 'private');
      unsubscribeMessage();
      unsubscribeTyping();
      
      if (socket) {
        socket.off('messages_loaded');
        socket.off('messages_marked_read');
        socket.off('group_message_received');
      }
    };
  }, [chatId, currentUser]);

  useEffect(() => {
    if (showAttachments) {
      Animated.spring(attachmentSlideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    } else {
      Animated.spring(attachmentSlideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    }
  }, [showAttachments]);

  const loadMessages = async () => {
    try {
      setLoading(true);
      chatService.loadChatMessages(chatId, 'private');
      
      const result = await chatService.getChatMessages(chatId);
      if (result.success) {
        setMessages(result.data || []);
        await chatService.markAsRead(chatId, 'private');
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: false });
        }, 100);
      }
    } catch (error) {
      console.error('Load messages error:', error);
      Alert.alert('Error', 'Problem loading messages');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (messageType = 'text', content = null) => {
    const messageContent = content || inputText.trim();
    if (!messageContent || sending) return;

    setInputText('');
    setSending(true);
    setSelectedImage(null);
    setShowAttachments(false);

    try {
      const result = await chatService.sendMessage(chatId, messageContent, messageType, 'private');
      
      if (!result.success) {
        Alert.alert('Error', result.message || 'Failed to send message');
        if (messageType === 'text') {
          setInputText(messageContent);
        }
      }

      stopTyping();
    } catch (error) {
      console.error('Send message error:', error);
      Alert.alert('Error', 'Problem sending message');
      if (messageType === 'text') {
        setInputText(messageContent);
      }
    } finally {
      setSending(false);
    }
  };

  const markAsRead = () => {
    chatService.markAsRead(chatId, 'private');
  };

  const startTyping = () => {
    chatService.startTyping(chatId, 'private');
  };

  const stopTyping = () => {
    chatService.stopTyping(chatId, 'private');
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
          aspect: [4, 3],
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
          aspect: [4, 3],
          quality: 0.8,
        });
      }

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        setSelectedImage(imageUri);
        
        Alert.alert('Image Selected', 'Send this image?', [
          { text: 'Cancel', style: 'cancel', onPress: () => setSelectedImage(null) },
          { text: 'Send', onPress: () => handleSendMessage('image', imageUri) }
        ]);
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Problem selecting image');
    }
  };

  const handleDocumentPick = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const document = result.assets[0];
        
        Alert.alert('File Selected', `Send ${document.name}?`, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Send', onPress: () => handleSendMessage('document', JSON.stringify(document)) }
        ]);
      }
    } catch (error) {
      console.error('Document picker error:', error);
      Alert.alert('Error', 'Problem selecting file');
    }
  };

  const handleInputChange = (text) => {
    setInputText(text);
    
    if (!isTyping) {
      setIsTyping(true);
      startTyping();
    }
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      stopTyping();
    }, 3000);
  };

  const formatMessageTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } else {
      return date.toLocaleDateString('en-US', {
        day: '2-digit',
        month: '2-digit',
      });
    }
  };

  const isMyMessage = (message) => {
    return message.senderId === (currentUser?.id || currentUser?._id);
  };

  const openImageModal = (imageUri) => {
    setModalImage(imageUri);
    setShowImageModal(true);
  };

  const renderMessageContent = (item) => {
    const isMine = isMyMessage(item);
    
    switch (item.messageType) {
      case 'image':
        return (
          <TouchableOpacity onPress={() => openImageModal(item.content)}>
            <Image 
              source={{ uri: item.content }} 
              style={styles.messageImage}
              resizeMode="cover"
            />
            <Text style={[
              styles.messageTime,
              isMine ? styles.myMessageTime : styles.otherMessageTime
            ]}>
              {formatMessageTime(item.createdAt)}
            </Text>
          </TouchableOpacity>
        );
      
      case 'document':
        try {
          const docData = JSON.parse(item.content);
          return (
            <View style={styles.documentMessage}>
              <Ionicons name="document-outline" size={24} color={isMine ? FLAVORWORLD_COLORS.white : FLAVORWORLD_COLORS.primary} />
              <View style={styles.documentInfo}>
                <Text style={[
                  styles.documentName,
                  isMine ? styles.myMessageText : styles.otherMessageText
                ]}>
                  {docData.name}
                </Text>
                <Text style={[
                  styles.documentSize,
                  isMine ? styles.myMessageTime : styles.otherMessageTime
                ]}>
                  {(docData.size / 1024).toFixed(1)} KB
                </Text>
              </View>
              <Text style={[
                styles.messageTime,
                isMine ? styles.myMessageTime : styles.otherMessageTime
              ]}>
                {formatMessageTime(item.createdAt)}
              </Text>
            </View>
          );
        } catch (e) {
          return (
            <Text style={[
              styles.messageText,
              isMine ? styles.myMessageText : styles.otherMessageText
            ]}>
              📎 File
            </Text>
          );
        }
      
      default:
        return (
          <>
            <Text style={[
              styles.messageText,
              isMine ? styles.myMessageText : styles.otherMessageText
            ]}>
              {item.content}
            </Text>
            
            <Text style={[
              styles.messageTime,
              isMine ? styles.myMessageTime : styles.otherMessageTime
            ]}>
              {formatMessageTime(item.createdAt)}
            </Text>
          </>
        );
    }
  };

  const renderMessage = ({ item, index }) => {
    const isMine = isMyMessage(item);
    const prevMessage = index > 0 ? messages[index - 1] : null;
    const nextMessage = index < messages.length - 1 ? messages[index + 1] : null;
    
    const showAvatar = !isMine && (!nextMessage || isMyMessage(nextMessage));
    const isConsecutive = prevMessage && 
      isMyMessage(prevMessage) === isMine && 
      new Date(item.createdAt) - new Date(prevMessage.createdAt) < 2 * 60 * 1000;

    return (
      <View style={[
        styles.messageContainer,
        isMine ? styles.myMessageContainer : styles.otherMessageContainer,
        isConsecutive && styles.consecutiveMessage
      ]}>
        {!isMine && showAvatar && (
          <UserAvatar
            uri={otherUser.userAvatar}
            name={otherUser.userName}
            size={28}
            style={styles.messageAvatar}
          />
        )}
        
        <View style={[
          styles.messageBubble,
          isMine ? styles.myMessageBubble : styles.otherMessageBubble,
          isConsecutive && (isMine ? styles.consecutiveMyBubble : styles.consecutiveOtherBubble),
          item.messageType === 'image' && styles.imageBubble
        ]}>
          {renderMessageContent(item)}
          
          {isMine && (
            <View style={styles.messageStatus}>
              <Ionicons 
                name="checkmark-done" 
                size={12} 
                color={item.readBy?.length > 1 ? FLAVORWORLD_COLORS.secondary : 'rgba(255,255,255,0.6)'} 
              />
            </View>
          )}
        </View>
        
        {!isMine && !showAvatar && <View style={styles.avatarSpacer} />}
      </View>
    );
  };

  const renderTypingIndicator = () => {
    if (!otherUserTyping) return null;
    
    return (
      <View style={styles.typingIndicator}>
        <View style={styles.typingBubble}>
          <Text style={styles.typingText}>{otherUser.userName} is typing...</Text>
        </View>
      </View>
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
          
          <View style={styles.userInfo}>
            <UserAvatar
              uri={otherUser.userAvatar}
              name={otherUser.userName}
              size={32}
            />
            <Text style={styles.userName}>{otherUser.userName}</Text>
          </View>
          
          <View style={styles.headerRight} />
        </View>
        
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={FLAVORWORLD_COLORS.primary} />
          <Text style={styles.loadingText}>Loading messages...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={FLAVORWORLD_COLORS.accent} />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.userInfo}
          onPress={() => navigation.navigate('Profile', { userId: otherUser.userId })}
        >
          <UserAvatar
            uri={otherUser.userAvatar}
            name={otherUser.userName}
            size={32}
            showOnlineStatus={true}
            isOnline={true}
          />
          <View style={styles.userDetails}>
            <Text style={styles.userName}>{otherUser.userName}</Text>
            <Text style={styles.userStatus}>
              {otherUserTyping ? 'typing...' : 'Active now'}
            </Text>
          </View>
        </TouchableOpacity>
        
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerButton}>
            <Ionicons name="videocam-outline" size={20} color={FLAVORWORLD_COLORS.accent} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton}>
            <Ionicons name="call-outline" size={20} color={FLAVORWORLD_COLORS.accent} />
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView 
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Messages List */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item._id}
          renderItem={renderMessage}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <View style={styles.emptyMessages}>
              <Ionicons name="chatbubbles-outline" size={60} color={FLAVORWORLD_COLORS.textLight} />
              <Text style={styles.emptyMessagesText}>Start a conversation!</Text>
              <Text style={styles.emptyMessagesSubtext}>
                This is your private chat with {otherUser.userName}
              </Text>
            </View>
          }
          ListFooterComponent={renderTypingIndicator}
        />

        {/* Attachment Options */}
        {showAttachments && (
          <Animated.View 
            style={[
              styles.attachmentOptions,
              {
                transform: [{
                  translateY: attachmentSlideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [100, 0],
                  }),
                }],
                opacity: attachmentSlideAnim,
              }
            ]}
          >
            <TouchableOpacity 
              style={styles.attachmentOption}
              onPress={() => handleImagePick('camera')}
            >
              <Ionicons name="camera" size={24} color={FLAVORWORLD_COLORS.white} />
              <Text style={styles.attachmentOptionText}>Camera</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.attachmentOption}
              onPress={() => handleImagePick('gallery')}
            >
              <Ionicons name="image" size={24} color={FLAVORWORLD_COLORS.white} />
              <Text style={styles.attachmentOptionText}>Gallery</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.attachmentOption}
              onPress={handleDocumentPick}
            >
              <Ionicons name="document" size={24} color={FLAVORWORLD_COLORS.white} />
              <Text style={styles.attachmentOptionText}>File</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.attachmentOption}
              onPress={() => {
                setShowAttachments(false);
                Alert.alert('Coming Soon', 'Location sharing will be added soon');
              }}
            >
              <Ionicons name="location" size={24} color={FLAVORWORLD_COLORS.white} />
              <Text style={styles.attachmentOptionText}>Location</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Selected Image Preview */}
        {selectedImage && (
          <View style={styles.selectedImageContainer}>
            <Image source={{ uri: selectedImage }} style={styles.selectedImage} />
            <TouchableOpacity 
              style={styles.removeImageButton}
              onPress={() => setSelectedImage(null)}
            >
              <Ionicons name="close" size={20} color={FLAVORWORLD_COLORS.white} />
            </TouchableOpacity>
          </View>
        )}

        {/* Input Container */}
        <View style={styles.inputContainer}>
          <View style={styles.inputRow}>
            <TouchableOpacity
              style={[
                styles.attachButton,
                showAttachments && styles.attachButtonActive
              ]}
              onPress={() => setShowAttachments(!showAttachments)}
            >
              <Ionicons 
                name={showAttachments ? "close" : "add"} 
                size={24} 
                color={showAttachments ? FLAVORWORLD_COLORS.white : FLAVORWORLD_COLORS.primary} 
              />
            </TouchableOpacity>
            
            <TextInput
              style={styles.textInput}
              value={inputText}
              onChangeText={handleInputChange}
              placeholder="Type a message..."
              placeholderTextColor={FLAVORWORLD_COLORS.textLight}
              multiline
              maxLength={1000}
              editable={!sending}
            />
            
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!inputText.trim() && !selectedImage || sending) && styles.sendButtonDisabled
              ]}
              onPress={() => handleSendMessage()}
              disabled={!inputText.trim() && !selectedImage || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color={FLAVORWORLD_COLORS.white} />
              ) : (
                <Ionicons name="send" size={20} color={FLAVORWORLD_COLORS.white} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Image Modal */}
      <Modal
        visible={showImageModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowImageModal(false)}
      >
        <View style={styles.imageModalContainer}>
          <TouchableOpacity 
            style={styles.imageModalOverlay}
            onPress={() => setShowImageModal(false)}
          />
          <View style={styles.imageModalContent}>
            <TouchableOpacity 
              style={styles.imageModalClose}
              onPress={() => setShowImageModal(false)}
            >
              <Ionicons name="close" size={24} color={FLAVORWORLD_COLORS.white} />
            </TouchableOpacity>
            
            {modalImage && (
              <Image 
                source={{ uri: modalImage }} 
                style={styles.fullScreenImage}
                resizeMode="contain"
              />
            )}
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
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  backButton: {
    padding: 8,
    backgroundColor: FLAVORWORLD_COLORS.background,
    borderRadius: 20,
  },
  userInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  userDetails: {
    marginLeft: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: FLAVORWORLD_COLORS.text,
  },
  userStatus: {
    fontSize: 12,
    color: FLAVORWORLD_COLORS.success,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: 8,
    backgroundColor: FLAVORWORLD_COLORS.background,
    borderRadius: 20,
    marginLeft: 8,
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
  chatContainer: {
    flex: 1,
  },
  messagesList: {
    flex: 1,
    backgroundColor: FLAVORWORLD_COLORS.background,
  },
  messagesContent: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  emptyMessages: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyMessagesText: {
    fontSize: 18,
    fontWeight: '600',
    color: FLAVORWORLD_COLORS.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyMessagesSubtext: {
    fontSize: 14,
    color: FLAVORWORLD_COLORS.textLight,
    textAlign: 'center',
  },
  messageContainer: {
    marginVertical: 2,
    maxWidth: '85%',
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  consecutiveMessage: {
    marginTop: 1,
  },
  myMessageContainer: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  otherMessageContainer: {
    alignSelf: 'flex-start',
  },
  messageAvatar: {
    marginRight: 8,
    marginBottom: 2,
  },
  avatarSpacer: {
    width: 36,
  },
  messageBubble: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    maxWidth: '100%',
    position: 'relative',
  },
  myMessageBubble: {
    backgroundColor: FLAVORWORLD_COLORS.primary,
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: FLAVORWORLD_COLORS.white,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: FLAVORWORLD_COLORS.border,
  },
  consecutiveMyBubble: {
    borderBottomRightRadius: 20,
  },
  consecutiveOtherBubble: {
    borderBottomLeftRadius: 20,
  },
  imageBubble: {
    padding: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  myMessageText: {
    color: FLAVORWORLD_COLORS.white,
  },
  otherMessageText: {
    color: FLAVORWORLD_COLORS.text,
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
  },
  myMessageTime: {
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'right',
  },
  otherMessageTime: {
    color: FLAVORWORLD_COLORS.textLight,
    textAlign: 'left',
  },
  messageStatus: {
    position: 'absolute',
    bottom: 4,
    right: 8,
  },
  messageImage: {
    width: 200,
    height: 150,
    borderRadius: 16,
    marginBottom: 4,
  },
  documentMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  documentInfo: {
    flex: 1,
    marginLeft: 12,
  },
  documentName: {
    fontSize: 14,
    fontWeight: '500',
  },
  documentSize: {
    fontSize: 12,
    marginTop: 2,
  },
  typingIndicator: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'flex-start',
  },
  typingBubble: {
    backgroundColor: FLAVORWORLD_COLORS.white,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: FLAVORWORLD_COLORS.border,
  },
  typingText: {
    fontSize: 14,
    color: FLAVORWORLD_COLORS.textLight,
    fontStyle: 'italic',
  },
  attachmentOptions: {
    flexDirection: 'row',
    backgroundColor: FLAVORWORLD_COLORS.white,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: FLAVORWORLD_COLORS.border,
    justifyContent: 'space-around',
  },
  attachmentOption: {
    alignItems: 'center',
    backgroundColor: FLAVORWORLD_COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    minWidth: 70,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  attachmentOptionText: {
    color: FLAVORWORLD_COLORS.white,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  selectedImageContainer: {
    position: 'relative',
    backgroundColor: FLAVORWORLD_COLORS.white,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: FLAVORWORLD_COLORS.border,
  },
  selectedImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  removeImageButton: {
    position: 'absolute',
    top: 4,
    right: 12,
    backgroundColor: FLAVORWORLD_COLORS.danger,
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputContainer: {
    backgroundColor: FLAVORWORLD_COLORS.white,
    borderTopWidth: 1,
    borderTopColor: FLAVORWORLD_COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  attachButton: {
    padding: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: FLAVORWORLD_COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachButtonActive: {
    backgroundColor: FLAVORWORLD_COLORS.primary,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: FLAVORWORLD_COLORS.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: FLAVORWORLD_COLORS.text,
    backgroundColor: FLAVORWORLD_COLORS.background,
    maxHeight: 100,
    marginRight: 12,
  },
  sendButton: {
    backgroundColor: FLAVORWORLD_COLORS.primary,
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  sendButtonDisabled: {
    backgroundColor: FLAVORWORLD_COLORS.textLight,
  },
  imageModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  imageModalContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: 8,
    zIndex: 1,
  },
  fullScreenImage: {
    width: screenWidth,
    height: '80%',
  },
});

export default ChatConversationScreen;