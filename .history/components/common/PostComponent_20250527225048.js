import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { recipeService } from '../../services/recipeService';

const { width: screenWidth } = Dimensions.get('window');

const PostComponent = ({ post, currentUser, onUpdate, onDelete, onShare }) => {
  const [isLiked, setIsLiked] = useState(post.likes?.includes(currentUser.id) || false);
  const [likesCount, setLikesCount] = useState(post.likes?.length || 0);
  const [showComments, setShowComments] = useState(false);
  const [showFullRecipe, setShowFullRecipe] = useState(false);
  const [comments, setComments] = useState(post.comments || []);
  const [newComment, setNewComment] = useState('');

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

  const handleLike = async () => {
    try {
      if (isLiked) {
        const result = await recipeService.unlikeRecipe(post._id);
        if (result.success) {
          setIsLiked(false);
          setLikesCount(prev => prev - 1);
        }
      } else {
        const result = await recipeService.likeRecipe(post._id);
        if (result.success) {
          setIsLiked(true);
          setLikesCount(prev => prev + 1);
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update like status');
    }
  };

  const handleDelete = () => {
    if (post.userId !== currentUser.id) {
      Alert.alert('Error', 'You can only delete your own recipes');
      return;
    }

    Alert.alert(
      'Delete Recipe',
      'Are you sure you want to delete this recipe?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDelete(post._id)
        }
      ]
    );
  };

  const renderFullRecipeModal = () => (
    <Modal
      visible={showFullRecipe}
      animationType="slide"
      onRequestClose={() => setShowFullRecipe(false)}
    >
      <ScrollView style={styles.fullRecipeContainer}>
        <View style={styles.fullRecipeHeader}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setShowFullRecipe(false)}
          >
            <Ionicons name="close" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.fullRecipeTitle}>{post.title}</Text>
        </View>

        {post.image && (
          <Image source={{ uri: post.image }} style={styles.fullRecipeImage} />
        )}

        <View style={styles.fullRecipeContent}>
          <View style={styles.recipeMetaRow}>
            <View style={styles.recipeMeta}>
              <Ionicons name="time-outline" size={16} color="#666" />
              <Text style={styles.recipeMetaText}>{formatTime(post.prepTime)}</Text>
            </View>
            <View style={styles.recipeMeta}>
              <Ionicons name="people-outline" size={16} color="#666" />
              <Text style={styles.recipeMetaText}>{post.servings} servings</Text>
            </View>
            <View style={styles.recipeMeta}>
              <Text style={styles.categoryTag}>{post.category}</Text>
            </View>
          </View>

          <Text style={styles.fullRecipeDescription}>{post.description}</Text>

          <View style={styles.recipeSection}>
            <Text style={styles.sectionTitle}>Ingredients</Text>
            <Text style={styles.sectionContent}>{post.ingredients}</Text>
          </View>

          <View style={styles.recipeSection}>
            <Text style={styles.sectionTitle}>Instructions</Text>
            <Text style={styles.sectionContent}>{post.instructions}</Text>
          </View>
        </View>
      </ScrollView>
    </Modal>
  );

  return (
    <View style={styles.container}>
      {/* Post Header */}
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <Image
            source={{ uri: post.userAvatar || 'https://randomuser.me/api/portraits/men/32.jpg' }}
            style={styles.avatar}
          />
          <View>
            <Text style={styles.userName}>{post.userName || 'Anonymous'}</Text>
            <Text style={styles.timeStamp}>{formatDate(post.createdAt)}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.moreButton}>
          <Ionicons name="ellipsis-horizontal" size={20} color="#65676b" />
        </TouchableOpacity>
      </View>

      {/* Recipe Content */}
      <TouchableOpacity onPress={() => setShowFullRecipe(true)}>
        <Text style={styles.recipeTitle}>{post.title || 'Untitled Recipe'}</Text>
        <Text style={styles.recipeDescription} numberOfLines={2}>
          {post.description || 'No description available'}
        </Text>

        <View style={styles.recipeInfo}>
          <View style={styles.recipeInfoItem}>
            <Ionicons name="time-outline" size={16} color="#FF6B35" />
            <Text style={styles.recipeInfoText}>{formatTime(post.prepTime)}</Text>
          </View>
          <View style={styles.recipeInfoItem}>
            <Ionicons name="people-outline" size={16} color="#FF6B35" />
            <Text style={styles.recipeInfoText}>{post.servings || 0} servings</Text>
          </View>
          <View style={styles.categoryContainer}>
            <Text style={styles.categoryTag}>{post.category || 'General'}</Text>
            <Text style={styles.meatTypeTag}>{post.meatType || 'Mixed'}</Text>
          </View>
        </View>

        {post.image && (
          <Image source={{ uri: post.image }} style={styles.recipeImage} />
        )}
      </TouchableOpacity>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
          <Ionicons
            name={isLiked ? "heart" : "heart-outline"}
            size={20}
            color={isLiked ? "#FF3B30" : "#65676b"}
          />
          <Text style={[styles.actionText, isLiked && styles.likedText]}>
            {likesCount}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => setShowComments(!showComments)}
        >
          <Ionicons name="chatbubble-outline" size={20} color="#65676b" />
          <Text style={styles.actionText}>{comments.length}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={onShare}>
          <Ionicons name="share-outline" size={20} color="#65676b" />
          <Text style={styles.actionText}>Share</Text>
        </TouchableOpacity>

        {post.userId === currentUser.id && (
          <TouchableOpacity style={styles.actionButton} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={20} color="#FF3B30" />
          </TouchableOpacity>
        )}
      </View>

      {showComments && (
        <View style={styles.commentsSection}>
          {comments.map((comment) => (
            <View key={comment.id} style={styles.comment}>
              <Text style={styles.commentUser}>{comment.userName}</Text>
              <Text style={styles.commentText}>{comment.text}</Text>
            </View>
          ))}
        </View>
      )}

      {renderFullRecipeModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  // כל ה-style נשאר כמו ששלחת – אם תרצה שאשלח גם את זה שוב, תגיד לי.
});

export default PostComponent;
