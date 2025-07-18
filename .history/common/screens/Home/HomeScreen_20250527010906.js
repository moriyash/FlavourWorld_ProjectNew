import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
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
import CreatePostComponent from '../../common/CreatePostComponent.js';
import PostComponent from '../../common/PostComponent.js';
import SharePostComponent from '../../common/SharePostComponent';
import { useAuth } from '../../../services/AuthContext.js';

// Mock data for current user
const currentUser = {
  id: 'user123',
  name: 'John Doe',
  avatar: 'https://randomuser.me/api/portraits/men/32.jpg'
};

// Mock data for stories
const storiesData = [
  { id: 'create', type: 'create', user: currentUser },
  { id: '1', type: 'story', user: { id: 'user1', name: 'Sarah', avatar: 'https://randomuser.me/api/portraits/women/44.jpg' }, hasNew: true },
  { id: '2', type: 'story', user: { id: 'user2', name: 'Mike', avatar: 'https://randomuser.me/api/portraits/men/86.jpg' }, hasNew: true },
  { id: '3', type: 'story', user: { id: 'user3', name: 'Emma', avatar: 'https://randomuser.me/api/portraits/women/65.jpg' }, hasNew: false },
  { id: '4', type: 'story', user: { id: 'user4', name: 'Alex', avatar: 'https://randomuser.me/api/portraits/men/22.jpg' }, hasNew: true },
  { id: '5', type: 'story', user: { id: 'user5', name: 'Lisa', avatar: 'https://randomuser.me/api/portraits/women/54.jpg' }, hasNew: false },
  { id: '6', type: 'story', user: { id: 'user6', name: 'David', avatar: 'https://randomuser.me/api/portraits/men/42.jpg' }, hasNew: true },
];

const HomeScreen = ({ navigation, route }) => {
  // 砖讬诪讜砖 讘拽讜谞讟拽住讟 诇拽讘诇转 讛讟讜拽谉 讜讛转谞转拽讜转
  const { userToken, logout } = useAuth();
  
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [postToShare, setPostToShare] = useState(null);
  const [activeTab, setActiveTab] = useState('home');
  const [showMenu, setShowMenu] = useState(false); // 讛讜住驻转 诪爪讘 诇转驻专讬讟

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = () => {
    setTimeout(() => {
      const mockPosts = [
        {
          id: 'post1',
          userId: 'user2',
          userName: 'Mike Johnson',
          userAvatar: 'https://randomuser.me/api/portraits/men/86.jpg',
          text: 'Just had an amazing day at the beach! The weather was perfect and the waves were awesome. #summer #beach #goodvibes',
          image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=800&q=80',
          createdAt: '2025-05-07T15:30:00.000Z',
          privacy: 'friends',
          likes: 42,
          comments: [
            { id: 'comment1', userId: 'user3', userName: 'Emma', text: 'Looks amazing!', createdAt: '2025-05-07T16:05:00.000Z' },
            { id: 'comment2', userId: 'user5', userName: 'Lisa', text: 'Wish I was there!', createdAt: '2025-05-07T16:30:00.000Z' }
          ]
        },
        {
          id: 'post2',
          userId: 'user123',
          userName: 'John Doe',
          userAvatar: 'https://randomuser.me/api/portraits/men/32.jpg',
          text: "Just finished working on my new React Native app. Can't wait to share it with you all!",
          image: null,
          createdAt: '2025-05-07T12:15:00.000Z',
          privacy: 'public',
          likes: 15,
          comments: []
        },
        {
          id: 'post3',
          userId: 'user4',
          userName: 'Alex Turner',
          userAvatar: 'https://randomuser.me/api/portraits/men/22.jpg',
          text: 'Check out this amazing sunset from my balcony!',
          image: 'https://images.unsplash.com/photo-1566261183150-8a76fa6d5500?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=800&q=80',
          createdAt: '2025-05-06T19:45:00.000Z',
          privacy: 'public',
          likes: 87,
          comments: [
            { id: 'comment3', userId: 'user1', userName: 'Sarah', text: 'Breathtaking!', createdAt: '2025-05-06T20:15:00.000Z' },
            { id: 'comment4', userId: 'user6', userName: 'David', text: 'Amazing colors!', createdAt: '2025-05-06T20:30:00.000Z' },
            { id: 'comment5', userId: 'user5', userName: 'Lisa', text: 'This is gorgeous!', createdAt: '2025-05-06T21:05:00.000Z' }
          ]
        },
        {
          id: 'post4',
          userId: 'user1',
          userName: 'Sarah Williams',
          userAvatar: 'https://randomuser.me/api/portraits/women/44.jpg',
          text: 'So excited to announce that I got the job at Google! 馃帀 Thanks everyone for your support!',
          image: null,
          createdAt: '2025-05-06T14:20:00.000Z',
          privacy: 'friends',
          likes: 124,
          comments: [
            { id: 'comment6', userId: 'user123', userName: 'John Doe', text: 'Congratulations! So happy for you!', createdAt: '2025-05-06T14:45:00.000Z' },
            { id: 'comment7', userId: 'user3', userName: 'Emma', text: 'Well deserved! 馃憦', createdAt: '2025-05-06T15:10:00.000Z' }
          ]
        }
      ];

      setPosts(mockPosts);
      setLoading(false);
      setRefreshing(false);
    }, 1500);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchPosts();
  };

  const handlePostCreated = (newPost) => {
    setPosts([newPost, ...posts]);
    setShowCreatePost(false);
  };

  const handlePostUpdate = (updatedPost) => {
    setPosts(posts.map(post =>
      post.id === updatedPost.id ? updatedPost : post
    ));
  };

  const handlePostDelete = (postId) => {
    setPosts(posts.filter(post => post.id !== postId));
  };

  const handleShare = (post) => {
    setPostToShare(post);
    setShareModalVisible(true);
  };

  const handleShareSubmit = (shareData) => {
    console.log('Sharing post with data:', shareData);
  };
  
  // 驻讜谞拽爪讬讛 讞讚砖讛: 讛转谞转拽讜转
  const handleLogout = () => {
    Alert.alert(
      "讛转谞转拽讜转",
      "讛讗诐 讗转讛 讘讟讜讞 砖讘专爪讜谞讱 诇讛转谞转拽?",
      [
        {
          text: "讘讬讟讜诇",
          style: "cancel"
        },
        { 
          text: "讛转谞转拽", 
          style: "destructive",
          onPress: async () => {
            try {
              // 拽专讬讗讛 诇驻讜谞拽爪讬讬转 讛转谞转拽讜转 诪讛拽讜谞讟拽住讟
              await logout();
              // 讗讬谉 爪讜专讱 诇谞讜讜讟 - AppNavigator 讬讟驻诇 讘讝讛
            } catch (error) {
              console.error("Logout error:", error);
              Alert.alert("Error", "Could not log out. Please try again.");
            }
          }
        }
      ]
    );
  };

  const renderStoryItem = ({ item }) => {
    if (item.type === 'create') {
      return (
        <TouchableOpacity style={styles.createStoryContainer} onPress={() => console.log('Create story')}>
          <View style={styles.createStoryImageContainer}>
            <Image source={{ uri: currentUser.avatar }} style={styles.storyImage} />
            <View style={styles.createStoryIconContainer}>
              <Ionicons name="add-circle" size={24} color="#0866ff" />
            </View>
          </View>
          <Text style={styles.storyText}>Your Story</Text>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity style={styles.storyContainer} onPress={() => console.log(`View ${item.user.name}'s story`)}>
        <View style={[styles.storyImageContainer, item.hasNew && styles.storyImageContainerNew]}>
          <Image source={{ uri: item.user.avatar }} style={styles.storyImage} />
        </View>
        <Text style={styles.storyText} numberOfLines={1}>{item.user.name}</Text>
      </TouchableOpacity>
    );
  };

  // 讛讜住驻转 讘专讻转 诪砖转诪砖
  const renderWelcome = () => (
    <View style={styles.welcomeContainer}>
      <Text style={styles.welcomeText}>讘专讜讱 讛讘讗!</Text>
    </View>
  );

  const renderHeader = () => (
    <>
      {/* 讛讜住驻转 讘专讻转 诪砖转诪砖 */}
      {renderWelcome()}
      
      <View style={styles.storiesContainer}>
        <FlatList
          data={storiesData}
          renderItem={renderStoryItem}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.storiesContentContainer}
        />
      </View>

      <TouchableOpacity
        style={styles.createPostButton}
        onPress={() => setShowCreatePost(true)}
      >
        <View style={styles.createPostButtonContent}>
          <Image source={{ uri: currentUser.avatar }} style={styles.userAvatar} />
          <View style={styles.createPostInputPlaceholder}>
            <Text style={styles.createPostText}>What's on your mind?</Text>
          </View>
        </View>
        <View style={styles.createPostActions}>
          <TouchableOpacity style={styles.createPostMediaButton}>
            <Ionicons name="images-outline" size={20} color="#4CAF50" />
            <Text style={[styles.createPostMediaText, { color: '#4CAF50' }]}>Photo</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </>
  );
  
  // 讛讜住驻转 转驻专讬讟 讛诪砖转诪砖
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
            <Text style={styles.menuItemText}>讛驻专讜驻讬诇 砖诇讬</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="settings-outline" size={24} color="#333" />
            <Text style={styles.menuItemText}>讛讙讚专讜转</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="help-circle-outline" size={24} color="#333" />
            <Text style={styles.menuItemText}>注讝专讛 讜转诪讬讻讛</Text>
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
            <Text style={styles.logoutText}>讛转谞转拽</Text>
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
          color={activeTab === 'home' ? "#0866ff" : "#65676b"} 
        />
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.tabItem} 
        onPress={() => setActiveTab('friends')}
      >
        <Ionicons 
          name={activeTab === 'friends' ? "people" : "people-outline"} 
          size={24} 
          color={activeTab === 'friends' ? "#0866ff" : "#65676b"} 
        />
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.tabItem} 
        onPress={() => setActiveTab('notifications')}
      >
        <Ionicons 
          name={activeTab === 'notifications' ? "notifications" : "notifications-outline"} 
          size={24} 
          color={activeTab === 'notifications' ? "#0866ff" : "#65676b"} 
        />
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.tabItem} 
        onPress={() => setShowMenu(true)}
      >
        <Ionicons 
          name={activeTab === 'menu' ? "menu" : "menu-outline"} 
          size={24} 
          color={activeTab === 'menu' ? "#0866ff" : "#65676b"} 
        />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>SocialApp</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerIconButton}>
            <Ionicons name="search" size={22} color="#000" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconButton}>
            <Ionicons name="chatbubbles-outline" size={22} color="#000" />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0866ff" />
        </View>
      ) : (
        <FlatList
          data={posts}
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
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#0866ff']}
            />
          }
          contentContainerStyle={styles.feedContent}
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
            <Text style={styles.modalTitle}>Create Post</Text>
            <View style={{ width: 24 }}></View>
          </View>

          <CreatePostComponent
            onPostCreated={handlePostCreated}
            currentUser={currentUser}
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
      
      {/* 讛讜住驻转 转驻专讬讟 讛诪砖转诪砖 */}
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
    color: '#0866ff',
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
  feedContent: {
    paddingBottom: 60, // Space for tab bar
  },
  // Welcome container - 讞讚砖
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
    textAlign: 'right', // 注讘讜专 转诪讬讻讛 讘注讘专讬转
  },
  storiesContainer: {
    backgroundColor: '#fff',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  storiesContentContainer: {
    paddingHorizontal: 10,
  },
  createStoryContainer: {
    width: 80,
    alignItems: 'center',
    marginRight: 8,
  },
  storyContainer: {
    width: 80,
    alignItems: 'center',
    marginRight: 8,
  },
  createStoryImageContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 1,
    borderColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5,
    position: 'relative',
  },
  storyImageContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 1,
    borderColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5,
  },
  storyImageContainerNew: {
    borderWidth: 2,
    borderColor: '#0866ff',
  },
  storyImage: {
    width: 65,
    height: 65,
    borderRadius: 33,
  },
  createStoryIconContainer: {
    position: 'absolute',
    bottom: -5,
    right: -5,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 2,
  },
  storyText: {
    fontSize: 12,
    color: '#65676b',
    textAlign: 'center',
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
  // Menu Modal Styles - 讞讚砖
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
});

export default HomeScreen;