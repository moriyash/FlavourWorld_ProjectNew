import React, { useState, useEffect ,useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  ScrollView,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  
} from 'react-native';
import { Video } from 'expo-av';

import { Ionicons } from '@expo/vector-icons';
import { recipeService } from '../../services/recipeService';
import { groupService } from '../../services/GroupService';
import { useAuth } from '../../services/AuthContext';
import UserAvatar from './UserAvatar';
import { notificationService } from '../../services/NotificationService';

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

const PostComponent = ({ 
  post, 
  onUpdate, 
  onDelete, 
  onShare,        // שיתוף חיצוני (WhatsApp, Instagram וכו')
  onShareCustom,  // שיתוף פנימי (עם חברים מהאפליקציה)
  onRefreshData, 
  navigation,
  isGroupPost = false,
  groupId = null 
}) => {
  const { width: screenWidth } = Dimensions.get('window'); // 🔥 הערתי את זה פנימה
  const safePost = post || {};
  const { currentUser, isLoading } = useAuth();
  
  
  const [localLikes, setLocalLikes] = useState(safePost.likes || []);
  const [localComments, setLocalComments] = useState(safePost.comments || []);
  
  const [showComments, setShowComments] = useState(false);
  const [showFullRecipe, setShowFullRecipe] = useState(false);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false); // 🆕 מודל שיתוף
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isSubmittingLike, setIsSubmittingLike] = useState(false);

  useEffect(() => {
    setLocalLikes(safePost.likes || []);
    setLocalComments(safePost.comments || []);
  }, [safePost.likes, safePost.comments]);

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', minHeight: 100 }]}>
        <ActivityIndicator size="small" color={FLAVORWORLD_COLORS.primary} />
        <Text style={{ marginTop: 8, color: FLAVORWORLD_COLORS.textLight }}>Loading...</Text>
      </View>
    );
  }

  const likesCount = localLikes.length;
  const comments = localComments;
  
  const currentUserId = currentUser?.id || currentUser?._id || currentUser?.userId;
  
  const currentUserName = currentUser?.fullName || currentUser?.name || currentUser?.displayName || currentUser?.username || 'Anonymous';
  
  const isLiked = currentUserId ? localLikes.some(likeUserId => 
    likeUserId === currentUserId || 
    likeUserId === currentUser?.id || 
    likeUserId === currentUser?._id
  ) : false;
  
  const postId = safePost._id || safePost.id;

  const isActualGroupPost = (isGroupPost && groupId) || safePost.groupId || safePost.postSource === 'group';
  const effectiveGroupId = groupId || safePost.groupId;

  const formatTime = (minutes) => {
    if (!minutes || isNaN(minutes)) return '0m';
    const numMinutes = parseInt(minutes);
    if (numMinutes < 60) {
      return `${numMinutes}m`;
    } else {
      const hours = Math.floor(numMinutes / 60);
      const remainingMinutes = numMinutes % 60;
      return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Just now';

    try {
      const date = new Date(dateString);
      const now = new Date();

      if (isNaN(date.getTime())) {
        return 'Just now';
      }

      const diffInMs = now - date;
      const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));

      if (diffInHours < 1) {
        return 'Just now';
      } else if (diffInHours < 24) {
        return `${diffInHours}h ago`;
      } else {
        const diffInDays = Math.floor(diffInHours / 24);
        return `${diffInDays}d ago`;
      }
    } catch (error) {
      return 'Just now';
    }
  };


const renderMedia = () => {
  // בדיקה אם יש מדיה להציג
  const hasImage = safePost.image;
  const hasVideo = safePost.video;
  const mediaType = safePost.mediaType || (hasImage ? 'image' : hasVideo ? 'video' : 'none');

  console.log('🎥 Rendering media:', { 
    mediaType, 
    hasImage: !!hasImage, 
    hasVideo: !!hasVideo,
    imageLength: hasImage ? hasImage.length : 0,
    videoLength: hasVideo ? hasVideo.length : 0
  });

  // אם אין מדיה, לא מציגים כלום
  if (mediaType === 'none' && !hasImage && !hasVideo) {
    console.log('❌ No media to display');
    return null;
  }

  return (
    <View style={styles.mediaContainer}>
      {/* הצגת תמונה */}
      {(mediaType === 'image' || (hasImage && !hasVideo)) && (
        <TouchableOpacity onPress={() => setShowFullRecipe(true)}>
          <Image 
            source={{ uri: safePost.image }} 
            style={styles.recipeImage}
            resizeMode="cover"
            onError={(error) => {
              console.log('❌ Image load error:', error);
            }}
            onLoad={() => {
              console.log('✅ Image loaded successfully');
            }}
          />
        </TouchableOpacity>
      )}
      
      {/* הצגת וידאו */}
      {(mediaType === 'video' || (hasVideo && !hasImage)) && (
        <View style={styles.videoWrapper}>
          <Video
            source={{ uri: safePost.video }}
            rate={1.0}
            volume={1.0}
            isMuted={false}
            resizeMode="cover" // שינוי מ-contain ל-cover לתצוגה טובה יותר
            shouldPlay={false}
            isLooping={false}
            style={styles.recipeVideo}
            useNativeControls={true}
            onError={(error) => {
              console.log('❌ Video load error:', error);
            }}
            onLoad={() => {
              console.log('✅ Video loaded successfully');
            }}
          />
          
          {/* אינדיקטור וידאו */}
          <View style={styles.videoIndicator}>
            <Ionicons name="play-circle" size={20} color={FLAVORWORLD_COLORS.white} />
            <Text style={styles.videoIndicatorText}>Video Recipe</Text>
          </View>
        </View>
      )}
    </View>
  );
};

  // 🎥 פונקציה לרנדור מדיה במסך מלא
  const renderFullRecipeMedia = () => {
  const hasImage = safePost.image;
  const hasVideo = safePost.video;
  const mediaType = safePost.mediaType || (hasImage ? 'image' : hasVideo ? 'video' : 'none');

  console.log('🎬 Rendering full screen media:', { 
    mediaType, 
    hasImage: !!hasImage, 
    hasVideo: !!hasVideo 
  });

  if (mediaType === 'none' && !hasImage && !hasVideo) {
    return (
      <View style={styles.noMediaPlaceholder}>
        <Ionicons name="restaurant-outline" size={80} color={FLAVORWORLD_COLORS.textLight} />
        <Text style={styles.noMediaText}>No media available</Text>
      </View>
    );
  }

  if ((mediaType === 'image' || (hasImage && !hasVideo))) {
    return (
      <Image 
        source={{ uri: safePost.image }} 
        style={styles.fullRecipeImage} 
        resizeMode="cover"
        onError={(error) => {
          console.log('❌ Full image load error:', error);
        }}
        onLoad={() => {
          console.log('✅ Full image loaded successfully');
        }}
      />
    );
  }

  if (mediaType === 'video' || (hasVideo && !hasImage)) {
    return (
      <View style={styles.fullRecipeVideoWrapper}>
        <Video
          source={{ uri: safePost.video }}
          rate={1.0}
          volume={1.0}
          isMuted={false}
          resizeMode="contain"
          shouldPlay={false}
          isLooping={false}
          style={styles.fullRecipeVideo}
          useNativeControls={true}
          onError={(error) => {
            console.log('❌ Full video load error:', error);
          }}
          onLoad={() => {
            console.log('✅ Full video loaded successfully');
          }}
        />
      </View>
    );
  }

  return null;
};
  
  const refreshNotificationsIfNeeded = useCallback(async (targetUserId) => {
    const currentUserId = currentUser?.id || currentUser?._id;
    if (targetUserId && targetUserId !== currentUserId) {
      console.log(' Action may trigger notification for user:', targetUserId);
    }
  }, [currentUser]);

  const handleLike = async () => {
    if (!postId) {
      console.error(' No postId available');
      Alert.alert('Error', 'Post ID not found');
      return;
    }
    
    if (!currentUserId) {
      console.error(' No currentUserId available');
      Alert.alert('Error', 'Please login to like recipes');
      return;
    }
    
    if (isSubmittingLike) {
      console.log(' Already submitting like...');
      return;
    }

    console.log(' Attempting to like/unlike:', { 
      postId, 
      currentUserId, 
      isLiked, 
      isActualGroupPost, 
      effectiveGroupId 
    });
    setIsSubmittingLike(true);

    const newLikes = isLiked 
      ? localLikes.filter(id => id !== currentUserId && id !== currentUser?.id && id !== currentUser?._id)
      : [...localLikes, currentUserId];
    
    setLocalLikes(newLikes);
    console.log(' Updated local likes optimistically:', newLikes);

    try {
      let result;
      
      if (isActualGroupPost && effectiveGroupId) {
        console.log(' Using group service for like/unlike...');
        if (isLiked) {
          console.log(' Unliking group post...');
          result = await groupService.unlikeGroupPost(effectiveGroupId, postId, currentUserId);
        } else {
          console.log(' Liking group post...');
          result = await groupService.likeGroupPost(effectiveGroupId, postId, currentUserId);
          if (!isLiked) {
            await refreshNotificationsIfNeeded(safePost.userId);
          }
        }
      } else {
        console.log('Using recipe service for like/unlike...');
        if (isLiked) {
          console.log(' Unliking recipe...');
          result = await recipeService.unlikeRecipe(postId, currentUserId);
        } else {
          console.log(' Liking recipe...');
          result = await recipeService.likeRecipe(postId, currentUserId);
          if (!isLiked) {
            await refreshNotificationsIfNeeded(safePost.userId);
          }
        }
      }

      console.log(' Like result:', result);

      if (result.success) {
        if (result.data && result.data.likes) {
          setLocalLikes(result.data.likes);
          console.log(' Updated likes from server:', result.data.likes);
        }
        
        setTimeout(() => {
          if (onRefreshData) {
            onRefreshData();
          }
        }, 500);
      } else {
        setLocalLikes(safePost.likes || []);
        Alert.alert('Error', result.message || 'Failed to update like');
      }
    } catch (error) {
      setLocalLikes(safePost.likes || []);
      console.error(' Like error:', error);
      Alert.alert('Error', 'Failed to update like status');
    } finally {
      setIsSubmittingLike(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) {
      Alert.alert('Empty Comment', 'Please write something delicious!');
      return;
    }

    if (!postId || isSubmittingComment) {
      return;
    }

    if (!currentUserId) {
      Alert.alert('Error', 'Please login to comment');
      return;
    }

    console.log(' Adding comment:', { 
      postId, 
      currentUserId, 
      currentUserName, 
      isActualGroupPost, 
      effectiveGroupId 
    });
    setIsSubmittingComment(true);

    try {
      let result;
      
      if (isActualGroupPost && effectiveGroupId) {
        console.log(' Adding comment to group post...');
        result = await groupService.addCommentToGroupPost(effectiveGroupId, postId, {
          text: newComment.trim(),
          userId: currentUserId,
          userName: currentUserName,
          userAvatar: currentUser?.avatar || currentUser?.userAvatar
        });
      } else {
        console.log(' Adding comment to regular post...');
        result = await recipeService.addComment(postId, {
          text: newComment.trim(),
          userId: currentUserId,
          userName: currentUserName,
          userAvatar: currentUser?.avatar || currentUser?.userAvatar
        });
      }

      if (result.success) {
        setNewComment('');
        
        if (result.data && result.data.comments) {
          setLocalComments(result.data.comments);
        }
        
        await refreshNotificationsIfNeeded(safePost.userId);
        
        if (onRefreshData) {
          onRefreshData();
        }
      } else {
        Alert.alert('Error', result.message || 'Failed to add comment');
      }
    } catch (error) {
      console.error(' Comment error:', error);
      Alert.alert('Error', 'Failed to add comment');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      let result;
      
      if (isActualGroupPost && effectiveGroupId) {
        console.log(' Deleting comment from group post...');
        result = await groupService.deleteCommentFromGroupPost(effectiveGroupId, postId, commentId, currentUserId);
      } else {
        console.log(' Deleting comment from regular post...');
        result = await recipeService.deleteComment(postId, commentId);
      }
      
      if (result.success) {
        setLocalComments(prev => prev.filter(comment => comment._id !== commentId));
        
        if (onRefreshData) {
          onRefreshData();
        }
      } else {
        Alert.alert('Error', result.message || 'Failed to delete comment');
      }
    } catch (error) {
      console.error(' Delete comment error:', error);
      Alert.alert('Error', 'Failed to delete comment');
    }
  };

  const handleEdit = () => {
    setShowOptionsModal(false);
    
    if (navigation) {
      navigation.navigate('EditPost', { 
        postId: postId,
        postData: {
          title: safePost.title,
          description: safePost.description,
          ingredients: safePost.ingredients,
          instructions: safePost.instructions,
          category: safePost.category,
          meatType: safePost.meatType,
          prepTime: safePost.prepTime,
          servings: safePost.servings,
          image: safePost.image,
          video: safePost.video,
          mediaType: safePost.mediaType
        },
        isGroupPost: isActualGroupPost,
        groupId: effectiveGroupId
      });
    }
  };

  const handleDelete = () => {
    setShowOptionsModal(false);
    
    if (!currentUserId || !safePost.userId) {
      Alert.alert('Error', 'Cannot determine ownership');
      return;
    }

    const postOwnerId = safePost.userId || safePost.user?.id || safePost.user?._id;
    if (postOwnerId !== currentUserId && postOwnerId !== currentUser?.id && postOwnerId !== currentUser?._id) {
      Alert.alert('Permission Denied', 'You can only delete your own recipes');
      return;
    }

    if (!postId) {
      Alert.alert('Error', 'Invalid post ID');
      return;
    }

    Alert.alert(
      'Delete Recipe',
      'Are you sure you want to delete this delicious recipe?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            if (onDelete) {
              onDelete(postId);
              console.log(' Parent onDelete called with:', postId); 
            }
          }
        }
      ]
    );
  };

  // 🆕 פונקציות שיתוף מעודכנות
  const handleShare = () => {
    setShowShareModal(true);
  };

  const handleInternalShare = () => {
    setShowShareModal(false);
    if (onShareCustom) {
      onShareCustom(safePost);
    } else {
      console.warn('onShareCustom is not provided to PostComponent');
    }
  };

  const handleExternalShare = () => {
    setShowShareModal(false);
    if (onShare) {
      onShare(safePost);
    } else {
      console.warn('onShare is not provided to PostComponent');
    }
  };

  const handleProfilePress = () => {
    if (navigation) {
      navigation.navigate('Profile', { 
        userId: safePost.userId || safePost.user?.id || safePost.user?._id 
      });
    }
  };

  const renderComment = ({ item }) => {
    console.log('Comment data:', item); 
    return(
      <View style={styles.commentItem}>
        <UserAvatar
          uri={item.userAvatar}
          name={item.userName || 'Anonymous'}
          size={32}
        />
        <View style={styles.commentContent}>
          <View style={styles.commentHeader}>
            <Text style={styles.commentUserName}>{item.userName || 'Anonymous'}</Text>
            <Text style={styles.commentTime}>{formatDate(item.createdAt)}</Text>
            {(item.userId === currentUserId || item.userId === currentUser?.id || item.userId === currentUser?._id) && (
              <TouchableOpacity 
                onPress={() => handleDeleteComment(item._id)}
                style={styles.deleteCommentButton}
              >
                <Ionicons name="trash-outline" size={16} color={FLAVORWORLD_COLORS.danger} />
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.commentText}>{item.text}</Text>
        </View>
      </View>
    );
  };

  const renderOptionsModal = () => {
    const isOwner = currentUserId && (
      safePost.userId === currentUserId || 
      safePost.userId === currentUser?.id || 
      safePost.userId === currentUser?._id
    );

    if (!isOwner) return null;

    return (
      <Modal
        visible={showOptionsModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowOptionsModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowOptionsModal(false)}
        >
          <View style={styles.optionsModal}>
            <TouchableOpacity style={styles.optionItem} onPress={handleEdit}>
              <Ionicons name="create-outline" size={20} color={FLAVORWORLD_COLORS.accent} />
              <Text style={styles.optionText}>Edit Recipe</Text>
            </TouchableOpacity>
            
            <View style={styles.optionSeparator} />
            
            <TouchableOpacity style={styles.optionItem} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={20} color={FLAVORWORLD_COLORS.danger} />
              <Text style={[styles.optionText, { color: FLAVORWORLD_COLORS.danger }]}>Delete Recipe</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    );
  };

  // 🆕 מודל שיתוף חדש
  const renderShareModal = () => (
    <Modal
      visible={showShareModal}
      animationType="fade"
      transparent={true}
      onRequestClose={() => setShowShareModal(false)}
    >
      <TouchableOpacity 
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setShowShareModal(false)}
      >
        <View style={styles.shareModal}>
          <Text style={styles.shareModalTitle}>Share Recipe</Text>
          
          <TouchableOpacity 
            style={styles.shareOptionItem} 
            onPress={handleInternalShare}
          >
            <View style={styles.shareOptionIcon}>
              <Ionicons name="people" size={24} color={FLAVORWORLD_COLORS.primary} />
            </View>
            <View style={styles.shareOptionContent}>
              <Text style={styles.shareOptionTitle}>Share with FlavorWorld Friends</Text>
              <Text style={styles.shareOptionSubtitle}>Send directly to friends and contacts</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={FLAVORWORLD_COLORS.textLight} />
          </TouchableOpacity>
          
          <View style={styles.optionSeparator} />
          
          <TouchableOpacity 
            style={styles.shareOptionItem} 
            onPress={handleExternalShare}
          >
            <View style={styles.shareOptionIcon}>
              <Ionicons name="share-outline" size={24} color={FLAVORWORLD_COLORS.secondary} />
            </View>
            <View style={styles.shareOptionContent}>
              <Text style={styles.shareOptionTitle}>Share to Other Apps</Text>
              <Text style={styles.shareOptionSubtitle}>WhatsApp, Instagram, Twitter, etc.</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={FLAVORWORLD_COLORS.textLight} />
          </TouchableOpacity>
          
          <View style={styles.optionSeparator} />
          
          <TouchableOpacity 
            style={styles.shareOptionItem} 
            onPress={() => setShowShareModal(false)}
          >
            <View style={styles.shareOptionIcon}>
              <Ionicons name="close" size={24} color={FLAVORWORLD_COLORS.textLight} />
            </View>
            <View style={styles.shareOptionContent}>
              <Text style={styles.shareOptionTitle}>Cancel</Text>
              <Text style={styles.shareOptionSubtitle}>Close this menu</Text>
            </View>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  const renderCommentsModal = () => (
    <Modal
      visible={showComments}
      animationType="slide"
      onRequestClose={() => setShowComments(false)}
    >
      <KeyboardAvoidingView 
        style={styles.commentsModalContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.commentsHeader}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setShowComments(false)}
          >
            <Ionicons name="close" size={24} color={FLAVORWORLD_COLORS.accent} />
          </TouchableOpacity>
          <Text style={styles.commentsTitle}>Comments ({comments.length})</Text>
          <View style={styles.placeholder} />
        </View>

        <FlatList
          data={comments}
          keyExtractor={(item) => item._id || item.id || Math.random().toString()}
          renderItem={renderComment}
          style={styles.commentsList}
          ListEmptyComponent={
            <View style={styles.emptyComments}>
              <Text style={styles.emptyCommentsText}>No comments yet</Text>
              <Text style={styles.emptyCommentsSubtext}>Be the first to share your thoughts!</Text>
            </View>
          }
        />

        <View style={styles.addCommentContainer}>
          <UserAvatar
            uri={currentUser?.avatar || currentUser?.userAvatar}
            name={currentUserName}
            size={32}
          />
          <TextInput
            style={styles.addCommentInput}
            placeholder="Share your thoughts on this recipe..."
            placeholderTextColor={FLAVORWORLD_COLORS.textLight}
            value={newComment}
            onChangeText={setNewComment}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[
              styles.addCommentButton,
              (!newComment.trim() || isSubmittingComment) && styles.addCommentButtonDisabled
            ]}
            onPress={handleAddComment}
            disabled={!newComment.trim() || isSubmittingComment}
          >
            {isSubmittingComment ? (
              <ActivityIndicator size="small" color={FLAVORWORLD_COLORS.primary} />
            ) : (
              <Ionicons name="send" size={20} color={FLAVORWORLD_COLORS.primary} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  const renderFullRecipeModal = () => (
    <Modal
      visible={showFullRecipe}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={() => setShowFullRecipe(false)}
    >
      <View style={styles.fullRecipeContainer}>
        <View style={styles.fullRecipeHeader}>
          <TouchableOpacity
            style={styles.fullRecipeCloseButton}
            onPress={() => setShowFullRecipe(false)}
          >
            <Ionicons name="close" size={28} color={FLAVORWORLD_COLORS.accent} />
          </TouchableOpacity>
          <Text style={styles.fullRecipeTitle} numberOfLines={2}>
            {safePost.title || 'Untitled Recipe'}
          </Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollContainer}>
          {/* 🆕 עדכון לתמיכה במדיה */}
          {renderFullRecipeMedia()}

          <View style={styles.fullRecipeContent}>
            <View style={styles.recipeMetaRow}>
              <View style={styles.recipeMeta}>
                <Ionicons name="time-outline" size={16} color={FLAVORWORLD_COLORS.primary} />
                <Text style={styles.recipeMetaText}>{formatTime(safePost.prepTime)}</Text>
              </View>
              <View style={styles.recipeMeta}>
                <Ionicons name="people-outline" size={16} color={FLAVORWORLD_COLORS.secondary} />
                <Text style={styles.recipeMetaText}>{safePost.servings || 0} servings</Text>
              </View>
              <View style={styles.recipeMeta}>
                <Text style={styles.categoryTag}>{safePost.category || 'General'}</Text>
              </View>
            </View>

            <Text style={styles.fullRecipeDescription}>
              {safePost.description || 'No description available'}
            </Text>

            <View style={styles.recipeSection}>
              <Text style={styles.sectionTitle}>🥘 Ingredients</Text>
              <Text style={styles.sectionContent}>
                {safePost.ingredients || 'No ingredients listed'}
              </Text>
            </View>

            <View style={styles.recipeSection}>
              <Text style={styles.sectionTitle}>👨‍🍳 Instructions</Text>
              <Text style={styles.sectionContent}>
                {safePost.instructions || 'No instructions provided'}
              </Text>
            </View>
            
            <View style={{ height: 100 }} />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.userInfo}
          onPress={handleProfilePress}
          activeOpacity={0.7}
        >
          <UserAvatar
            uri={safePost.userAvatar}
            name={safePost.userName || 'Anonymous Chef'}
            size={40}
          />
          <View style={styles.userDetails}>
            <Text style={styles.userName}>
              {safePost.userName || 'Anonymous Chef'}
            </Text>
            <Text style={styles.timeStamp}>
              {formatDate(safePost.createdAt)}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.moreButton}
          onPress={() => setShowOptionsModal(true)}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={FLAVORWORLD_COLORS.textLight} />
        </TouchableOpacity>
      </View>

      {/* Recipe Content */}
      <TouchableOpacity onPress={() => setShowFullRecipe(true)}>
        <Text style={styles.recipeTitle}>
          {safePost.title || 'Untitled Recipe'}
        </Text>
        <Text style={styles.recipeDescription} numberOfLines={2}>
          {safePost.description || 'No description available'}
        </Text>

        <View style={styles.recipeInfo}>
          <View style={styles.recipeInfoItem}>
            <Ionicons name="time-outline" size={16} color={FLAVORWORLD_COLORS.primary} />
            <Text style={styles.recipeInfoText}>
              {formatTime(safePost.prepTime)}
            </Text>
          </View>
          <View style={styles.recipeInfoItem}>
            <Ionicons name="people-outline" size={16} color={FLAVORWORLD_COLORS.secondary} />
            <Text style={styles.recipeInfoText}>
              {safePost.servings || 0} servings
            </Text>
          </View>
          <View style={styles.categoryContainer}>
            <Text style={styles.categoryTag}>
              {safePost.category || 'General'}
            </Text>
            <Text style={styles.meatTypeTag}>
              {safePost.meatType || 'Mixed'}
            </Text>
          </View>
        </View>

        {/* 🆕 הצגת מדיה - תמונה או וידאו */}
        {renderMedia()}
      </TouchableOpacity>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity 
          style={[styles.actionButton, isSubmittingLike && styles.actionButtonDisabled]} 
          onPress={handleLike}
          disabled={isSubmittingLike}
        >
          {isSubmittingLike ? (
            <ActivityIndicator size="small" color={FLAVORWORLD_COLORS.primary} />
          ) : (
            <Ionicons
              name={isLiked ? "heart" : "heart-outline"}
              size={20}
              color={isLiked ? FLAVORWORLD_COLORS.danger : FLAVORWORLD_COLORS.textLight}
            />
          )}
          <Text style={[styles.actionText, isLiked && styles.likedText]}>
            {likesCount}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => setShowComments(true)}
        >
          <Ionicons name="chatbubble-outline" size={20} color={FLAVORWORLD_COLORS.textLight} />
          <Text style={styles.actionText}>{comments.length}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
          <Ionicons name="share-outline" size={20} color={FLAVORWORLD_COLORS.textLight} />
          <Text style={styles.actionText}>Share</Text>
        </TouchableOpacity>
      </View>

      {renderOptionsModal()}
      {renderShareModal()} {/* 🆕 הוספת מודל השיתוף */}
      {renderCommentsModal()}
      {renderFullRecipeModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: FLAVORWORLD_COLORS.white,
    marginBottom: 8,
    paddingVertical: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userDetails: {
    marginLeft: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: FLAVORWORLD_COLORS.text,
  },
  timeStamp: {
    fontSize: 12,
    color: FLAVORWORLD_COLORS.textLight,
    marginTop: 2,
  },
  moreButton: {
    padding: 8,
    backgroundColor: FLAVORWORLD_COLORS.background,
    borderRadius: 20,
  },
  recipeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: FLAVORWORLD_COLORS.text,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  recipeDescription: {
    fontSize: 14,
    color: FLAVORWORLD_COLORS.textLight,
    marginHorizontal: 16,
    marginBottom: 12,
    lineHeight: 20,
  },
  recipeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  recipeInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 4,
  },
  recipeInfoText: {
    fontSize: 12,
    color: FLAVORWORLD_COLORS.textLight,
    marginLeft: 4,
    fontWeight: '500',
  },
  categoryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryTag: {
    fontSize: 12,
    color: FLAVORWORLD_COLORS.secondary,
    backgroundColor: FLAVORWORLD_COLORS.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
    fontWeight: '600',
  },
  meatTypeTag: {
    fontSize: 12,
    color: FLAVORWORLD_COLORS.accent,
    backgroundColor: FLAVORWORLD_COLORS.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    fontWeight: '600',
  },
  // 🎨 סטיילים חדשים למדיה
  mediaContainer: {
    marginTop: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  recipeImage: {
    width: screenWidth,
    height: 200,
    resizeMode: 'cover',
  },
  videoWrapper: {
    position: 'relative',
    width: screenWidth,
    height: 200,
    backgroundColor: FLAVORWORLD_COLORS.text,
  },
  recipeVideo: {
    width: '100%',
    height: '100%',
  },
  videoIndicator: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  videoIndicatorText: {
    color: FLAVORWORLD_COLORS.white,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  // 🎬 סטיילים לוידאו במסך מלא
  fullRecipeVideoWrapper: {
    width: screenWidth,
    height: 250,
    backgroundColor: FLAVORWORLD_COLORS.text,
  },
  fullRecipeVideo: {
    width: '100%',
    height: '100%',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: FLAVORWORLD_COLORS.border,
    marginTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: FLAVORWORLD_COLORS.background,
    borderRadius: 20,
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  actionText: {
    fontSize: 14,
    color: FLAVORWORLD_COLORS.textLight,
    marginLeft: 4,
    fontWeight: '500',
  },
  likedText: {
    color: FLAVORWORLD_COLORS.danger,
  },
  
  // Options Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionsModal: {
    backgroundColor: FLAVORWORLD_COLORS.white,
    borderRadius: 12,
    paddingVertical: 8,
    minWidth: 160,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '500',
    color: FLAVORWORLD_COLORS.text,
    marginLeft: 12,
  },
  optionSeparator: {
    height: 1,
    backgroundColor: FLAVORWORLD_COLORS.border,
    marginHorizontal: 16,
  },
  
  // 🆕 סטיילים חדשים למודל שיתוף
  shareModal: {
    backgroundColor: FLAVORWORLD_COLORS.white,
    borderRadius: 16,
    paddingVertical: 16,
    minWidth: 300,
    maxWidth: '90%',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  shareModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: FLAVORWORLD_COLORS.text,
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  shareOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  shareOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: FLAVORWORLD_COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  shareOptionContent: {
    flex: 1,
  },
  shareOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: FLAVORWORLD_COLORS.text,
    marginBottom: 2,
  },
  shareOptionSubtitle: {
    fontSize: 14,
    color: FLAVORWORLD_COLORS.textLight,
    lineHeight: 18,
  },
  
  // Comments Modal Styles
  commentsModalContainer: {
    flex: 1,
    backgroundColor: FLAVORWORLD_COLORS.background,
    paddingTop: 50,
  },
  commentsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: FLAVORWORLD_COLORS.border,
    backgroundColor: FLAVORWORLD_COLORS.white,
  },
  commentsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: FLAVORWORLD_COLORS.text,
  },
  closeButton: {
    padding: 8,
    backgroundColor: FLAVORWORLD_COLORS.background,
    borderRadius: 20,
  },
  placeholder: {
    width: 32,
  },
  commentsList: {
    flex: 1,
    paddingHorizontal: 16,
    backgroundColor: FLAVORWORLD_COLORS.white,
  },
  commentItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: FLAVORWORLD_COLORS.border,
  },
  commentContent: {
    flex: 1,
    marginLeft: 12,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  commentUserName: {
    fontSize: 14,
    fontWeight: '600',
    color: FLAVORWORLD_COLORS.text,
    marginRight: 8,
  },
  commentTime: {
    fontSize: 12,
    color: FLAVORWORLD_COLORS.textLight,
    flex: 1,
  },
  deleteCommentButton: {
    padding: 4,
    backgroundColor: FLAVORWORLD_COLORS.background,
    borderRadius: 12,
  },
  commentText: {
    fontSize: 14,
    color: FLAVORWORLD_COLORS.text,
    lineHeight: 18,
  },
  emptyComments: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyCommentsText: {
    fontSize: 16,
    color: FLAVORWORLD_COLORS.textLight,
    marginBottom: 4,
    fontWeight: '600',
  },
  emptyCommentsSubtext: {
    fontSize: 14,
    color: FLAVORWORLD_COLORS.textLight,
  },
  addCommentContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: FLAVORWORLD_COLORS.border,
    backgroundColor: FLAVORWORLD_COLORS.white,
  },
  addCommentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: FLAVORWORLD_COLORS.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 100,
    fontSize: 14,
    backgroundColor: FLAVORWORLD_COLORS.background,
    color: FLAVORWORLD_COLORS.text,
    marginHorizontal: 12,
  },
  addCommentButton: {
    padding: 8,
    backgroundColor: FLAVORWORLD_COLORS.background,
    borderRadius: 20,
  },
  addCommentButtonDisabled: {
    opacity: 0.5,
  },
  
  // Full Recipe Modal Styles
  fullRecipeContainer: {
    flex: 1,
    backgroundColor: FLAVORWORLD_COLORS.background,
    paddingTop: 50,
  },
  fullRecipeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: FLAVORWORLD_COLORS.border,
    backgroundColor: FLAVORWORLD_COLORS.white,
    position: 'relative',
  },
  fullRecipeCloseButton: {
    position: 'absolute',
    right: 16,
    padding: 8,
    backgroundColor: FLAVORWORLD_COLORS.background,
    borderRadius: 20,
    zIndex: 1,
  },
  fullRecipeTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: FLAVORWORLD_COLORS.text,
    textAlign: 'center',
    paddingHorizontal: 60,
  },
  scrollContainer: {
    flex: 1,
  },
  fullRecipeImage: {
    width: screenWidth,
    height: 250,
    resizeMode: 'cover',
  },
  fullRecipeContent: {
    padding: 16,
    backgroundColor: FLAVORWORLD_COLORS.white,
  },
  recipeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  recipeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 8,
    backgroundColor: FLAVORWORLD_COLORS.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  recipeMetaText: {
    fontSize: 14,
    color: FLAVORWORLD_COLORS.text,
    marginLeft: 4,
    fontWeight: '500',
  },
  fullRecipeDescription: {
    fontSize: 16,
    color: FLAVORWORLD_COLORS.text,
    lineHeight: 24,
    marginBottom: 20,
  },
  recipeSection: {
    marginBottom: 20,
    backgroundColor: FLAVORWORLD_COLORS.background,
    padding: 16,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: FLAVORWORLD_COLORS.text,
    marginBottom: 8,
  },
  sectionContent: {
    fontSize: 16,
    color: FLAVORWORLD_COLORS.text,
    lineHeight: 24,
  },
  // 🆕 הוספת סטיילים חסרים
  noMediaPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 250,
    backgroundColor: FLAVORWORLD_COLORS.background,
  },
  noMediaText: {
    fontSize: 16,
    color: FLAVORWORLD_COLORS.textLight,
    marginTop: 12,
  },
});

export default PostComponent;