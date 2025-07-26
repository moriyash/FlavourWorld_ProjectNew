import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Image,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../services/AuthContext';
import { recipeService } from '../../../services/recipeService';
import { groupService } from '../../../services/GroupService';
import UserAvatar from '../../common/UserAvatar';

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

const { width: screenWidth } = Dimensions.get('window');

const PostModalScreen = ({ route, navigation }) => {
  const { currentUser } = useAuth();
  const { 
    postId, 
    groupId, 
    isGroupPost = false, 
    postTitle = 'Recipe',
    postImage 
  } = route.params;

  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    loadPost();
  }, []);

  const loadPost = async () => {
    try {
      setLoading(true);
      let result;

      if (isGroupPost && groupId) {
        console.log('Loading group post:', postId);
        const groupPostsResult = await groupService.getGroupPosts(groupId, currentUser?.id);
        if (groupPostsResult.success) {
          const foundPost = groupPostsResult.data.find(p => 
            (p._id || p.id) === postId
          );
          if (foundPost) {
            result = { success: true, data: foundPost };
          } else {
            result = { success: false, message: 'Post not found' };
          }
        } else {
          result = groupPostsResult;
        }
      } else {
        console.log('Loading regular post:', postId);
        result = await recipeService.getRecipeById(postId);
      }

      if (result.success) {
        setPost(result.data);
      } else {
        Alert.alert('Error', result.message || 'Failed to load post');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Load post error:', error);
      Alert.alert('Error', 'Failed to load post');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={FLAVORWORLD_COLORS.white} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={FLAVORWORLD_COLORS.primary} />
          <Text style={styles.loadingText}>Loading recipe...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={FLAVORWORLD_COLORS.white} />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={80} color={FLAVORWORLD_COLORS.danger} />
          <Text style={styles.errorTitle}>Recipe Not Found</Text>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={FLAVORWORLD_COLORS.white} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="close" size={28} color={FLAVORWORLD_COLORS.accent} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={2}>
          {post.title || 'Recipe'}
        </Text>
      </View>

      {/* Content */}
      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollContainer}>
        {/* Image */}
        {post.image && (
          <Image source={{ uri: post.image }} style={styles.recipeImage} />
        )}

        <View style={styles.recipeContent}>
          {/* Meta info */}
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={16} color={FLAVORWORLD_COLORS.primary} />
              <Text style={styles.metaText}>{formatTime(post.prepTime)}</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="people-outline" size={16} color={FLAVORWORLD_COLORS.secondary} />
              <Text style={styles.metaText}>{post.servings || 0} servings</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.categoryTag}>{post.category || 'General'}</Text>
            </View>
          </View>

          {/* Author info */}
          <View style={styles.authorInfo}>
            <UserAvatar
              uri={post.userAvatar}
              name={post.userName || 'Chef'}
              size={40}
            />
            <View style={styles.authorDetails}>
              <Text style={styles.authorName}>{post.userName || 'Anonymous Chef'}</Text>
              {isGroupPost && (
                <Text style={styles.groupName}>from group</Text>
              )}
            </View>
          </View>

          {/* Description */}
          <Text style={styles.description}>
            {post.description || 'No description available'}
          </Text>

          {/* Ingredients */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ingredients</Text>
            <Text style={styles.sectionContent}>
              {post.ingredients || 'No ingredients listed'}
            </Text>
          </View>

          {/* Instructions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Instructions</Text>
            <Text style={styles.sectionContent}>
              {post.instructions || 'No instructions provided'}
            </Text>
          </View>
          
          <View style={{ height: 50 }} />
        </View>
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: FLAVORWORLD_COLORS.border,
    backgroundColor: FLAVORWORLD_COLORS.white,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    padding: 8,
    backgroundColor: FLAVORWORLD_COLORS.background,
    borderRadius: 20,
    zIndex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: FLAVORWORLD_COLORS.text,
    textAlign: 'center',
    paddingHorizontal: 60,
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: FLAVORWORLD_COLORS.text,
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: FLAVORWORLD_COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  backButtonText: {
    color: FLAVORWORLD_COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  scrollContainer: {
    flex: 1,
  },
  recipeImage: {
    width: screenWidth,
    height: 250,
    resizeMode: 'cover',
  },
  recipeContent: {
    padding: 16,
    backgroundColor: FLAVORWORLD_COLORS.white,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 8,
    backgroundColor: FLAVORWORLD_COLORS.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  metaText: {
    fontSize: 14,
    color: FLAVORWORLD_COLORS.text,
    marginLeft: 4,
    fontWeight: '500',
  },
  categoryTag: {
    fontSize: 14,
    color: FLAVORWORLD_COLORS.secondary,
    fontWeight: '600',
    backgroundColor: FLAVORWORLD_COLORS.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    padding: 12,
    backgroundColor: FLAVORWORLD_COLORS.background,
    borderRadius: 12,
  },
  authorDetails: {
    marginLeft: 12,
  },
  authorName: {
    fontSize: 16,
    fontWeight: '600',
    color: FLAVORWORLD_COLORS.text,
  },
  groupName: {
    fontSize: 14,
    color: FLAVORWORLD_COLORS.textLight,
    marginTop: 2,
  },
  description: {
    fontSize: 16,
    color: FLAVORWORLD_COLORS.text,
    lineHeight: 24,
    marginBottom: 20,
  },
  section: {
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
});

export default PostModalScreen;