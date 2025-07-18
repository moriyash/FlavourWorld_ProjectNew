import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../services/AuthContext.js';
import CreatePostComponent from '../../common/CreatePostComponent.js';
import SharePostComponent from '../../common/SharePostComponent.js';
import PostComponent from '../../common/PostComponent.js';
import { recipeService } from '../../../services/recipeService.js';

// נתוני המשתמש יבואו מהקונטקסט

const HomeScreen = ({ navigation, route }) => {
  const { userToken, logout, currentUser } = useAuth();
  
  // ברירת מחדל אם אין נתוני משתמש
  const user = currentUser || {
    id: 'user123',
    fullName: 'User',
    email: 'user@example.com'
  };
  
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [postToShare, setPostToShare] = useState(null);
  const [activeTab, setActiveTab] = useState('home');
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    fetchRecipes();
  }, []);

  const fetchRecipes = async () => {
    try {
      const result = await recipeService.getAllRecipes();
      if (result.success) {
        // Sort recipes by creation date (newest first)
        const sortedRecipes = result.data.sort((a, b) => 
          new Date(b.createdAt) - new Date(a.createdAt)
        );
        setRecipes(sortedRecipes);
      } else {
        console.log('No recipes found or error loading recipes');
        setRecipes([]);
      }
    } catch (error) {
      console.error('Error fetching recipes:', error);
      setRecipes([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchRecipes();
  };

  const handlePostCreated = (newRecipe) => {
    // Add new recipe to the top of the list
    setRecipes([newRecipe, ...recipes]);
    setShowCreatePost(false);
  };

  const handlePostUpdate = (updatedRecipe) => {
    setRecipes(recipes.map(recipe =>
      recipe._id === updatedRecipe._id ? updatedRecipe : recipe
    ));
  };

  const handlePostDelete = async (recipeId) => {
    try {
      const result = await recipeService.deleteRecipe(recipeId);
      if (result.success) {
        setRecipes(recipes.filter(recipe => recipe._id !== recipeId));
        Alert.alert('Success', 'Recipe deleted successfully');
      } else {
        Alert.alert('Error', result.message);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to delete recipe');
    }
  };

  const handleShare = (recipe) => {
    setPostToShare(recipe);
    setShareModalVisible(true);
  };

  const handleShareSubmit = (shareData) => {
    console.log('Sharing recipe with data:', shareData);
  };
  
  const handleLogout = () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        { 
          text: "Logout", 
          style: "destructive",
          onPress: async () => {
            try {
              await logout();
            } catch (error) {
              console.error("Logout error:", error);
              Alert.alert("Error", "Could not log out. Please try again.");
            }
          }
        }
      ]
    );
  };

  const renderWelcome = () => (
    <View style={styles.welcomeContainer}>
      <Text style={styles.welcomeText}>Welcome to Recipe Share!</Text>
      <Text style={styles.welcomeSubtext}>Share your favorite recipes with the community</Text>
    </View>
  );

  const renderHeader = () => (
    <>
      {renderWelcome()}
      
      <TouchableOpacity
        style={styles.createPostButton}
        onPress={() => setShowCreatePost(true)}
      >
        <View style={styles.createPostButtonContent}>
          <Image source={{ uri: currentUser.avatar }} style={styles.userAvatar} />
          <View style={styles.createPostInputPlaceholder}>
            <Text style={styles.createPostText}>Share a new recipe...</Text>
          </View>
        </View>
        <View style={styles.createPostActions}>
          <TouchableOpacity style={styles.createPostMediaButton}>
            <Ionicons name="restaurant-outline" size={20} color="#FF6B35" />
            <Text style={[styles.createPostMediaText, { color: '#FF6B35' }]}>Recipe</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.createPostMediaButton}>
            <Ionicons name="images-outline" size={20} color="#4CAF50" />
            <Text style={[styles.createPostMediaText, { color: '#4CAF50' }]}>Photo</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </>
  );
  
  const renderMenuModal = () => (
    <Modal
      visible={showMenu}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowMenu(false)}
    >
      <TouchableOpacity 
        style={styles.menuModalOverlay}
        activeOpacity={1}
        onPress={() => setShowMenu(false)}
      >
        <View style={styles.menuModalContent}>
          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="person-outline" size={24} color="#333" />
            <Text style={styles.menuItemText}>My Profile</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="settings-outline" size={24} color="#333" />
            <Text style={styles.menuItemText}>Settings</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="help-circle-outline" size={24} color="#333" />
            <Text style={styles.menuItemText}>Help & Support</Text>
          </TouchableOpacity>
          
          <View style={styles.menuSeparator} />
          
          <TouchableOpacity 
            style={[styles.menuItem, styles.logoutMenuItem]}
            onPress={() => {
              setShowMenu(false);
              handleLogout();
            }}
          >
            <Ionicons name="log-out-outline" size={24} color="#FF3B30" />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  const renderTabBar = () => (
    <View style={styles.tabBar}>
      <TouchableOpacity 
        style={styles.tabItem} 
        onPress={() => setActiveTab('home')}
      >
        <Ionicons 
          name={activeTab === 'home' ? "home" : "home-outline"} 
          size={24} 
          color={activeTab === 'home' ? "#FF6B35" : "#65676b"} 
        />
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.tabItem} 
        onPress={() => setActiveTab('search')}
      >
        <Ionicons 
          name={activeTab === 'search' ? "search" : "search-outline"} 
          size={24} 
          color={activeTab === 'search' ? "#FF6B35" : "#65676b"} 
        />
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.tabItem} 
        onPress={() => setActiveTab('favorites')}
      >
        <Ionicons 
          name={activeTab === 'favorites' ? "heart" : "heart-outline"} 
          size={24} 
          color={activeTab === 'favorites' ? "#FF6B35" : "#65676b"} 
        />
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.tabItem} 
        onPress={() => setShowMenu(true)}
      >
        <Ionicons 
          name={activeTab === 'menu' ? "menu" : "menu-outline"} 
          size={24} 
          color={activeTab === 'menu' ? "#FF6B35" : "#65676b"} 
        />
      </TouchableOpacity>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyStateContainer}>
      <Ionicons name="restaurant-outline" size={80} color="#ccc" />
      <Text style={styles.emptyStateTitle}>No Recipes Yet</Text>
      <Text style={styles.emptyStateText}>
        Be the first to share a delicious recipe with the community!
      </Text>
      <TouchableOpacity
        style={styles.emptyStateButton}
        onPress={() => setShowCreatePost(true)}
      >
        <Text style={styles.emptyStateButtonText}>Share Your First Recipe</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Recipe Share</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerIconButton}>
            <Ionicons name="search" size={22} color="#000" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconButton}>
            <Ionicons name="notifications-outline" size={22} color="#000" />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
          <Text style={styles.loadingText}>Loading recipes...</Text>
        </View>
      ) : (
        <FlatList
          data={recipes}
          renderItem={({ item }) => (
            <PostComponent
              post={item}
              currentUser={currentUser}
              onUpdate={handlePostUpdate}
              onDelete={handlePostDelete}
              onShare={() => handleShare(item)}
              navigation={navigation}
            />
          )}
          keyExtractor={(item) => item._id}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#FF6B35']}
            />
          }
          contentContainerStyle={[
            styles.feedContent,
            recipes.length === 0 && styles.emptyFeedContent
          ]}
          ItemSeparatorComponent={() => <View style={styles.postSeparator} />}
        />
      )}

      <Modal
        visible={showCreatePost}
        animationType="slide"
        onRequestClose={() => setShowCreatePost(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCreatePost(false)}>
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Share Recipe</Text>
            <View style={{ width: 24 }}></View>
          </View>

          <CreatePostComponent
            onPostCreated={handlePostCreated}
            currentUser={user}
          />
        </SafeAreaView>
      </Modal>

      <SharePostComponent
        visible={shareModalVisible}
        onClose={() => setShareModalVisible(false)}
        post={postToShare}
        onShare={handleShareSubmit}
        currentUserId={currentUser.id}
      />
      
      {renderMenuModal()}
      {renderTabBar()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f0f2f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FF6B35',
  },
  headerRight: {
    flexDirection: 'row',
  },
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f2f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  feedContent: {
    paddingBottom: 60,
  },
  emptyFeedContent: {
    flexGrow: 1,
  },
  welcomeContainer: {
    backgroundColor: '#fff',
    padding: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  welcomeText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  welcomeSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  createPostButton: {
    backgroundColor: '#fff',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  createPostButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  createPostInputPlaceholder: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 15,
    justifyContent: 'center',
  },
  createPostText: {
    color: '#65676b',
  },
  createPostActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  createPostMediaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  createPostMediaText: {
    marginLeft: 5,
    fontWeight: '500',
  },
  postSeparator: {
    height: 8,
    backgroundColor: '#f0f2f5',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  tabItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  },
  menuModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  menuModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 30,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
  },
  menuItemText: {
    fontSize: 16,
    marginLeft: 15,
    color: '#333',
  },
  menuSeparator: {
    height: 1,
    backgroundColor: '#ddd',
    marginVertical: 10,
  },
  logoutMenuItem: {
    marginTop: 5,
  },
  logoutText: {
    fontSize: 16,
    marginLeft: 15,
    color: '#FF3B30',
    fontWeight: '500',
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },
  emptyStateButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  emptyStateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default HomeScreen;