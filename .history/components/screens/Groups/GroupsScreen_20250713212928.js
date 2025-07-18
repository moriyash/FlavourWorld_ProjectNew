import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  FlatList,
  Image,
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../services/AuthContext';
import { groupService } from '../../../services/GroupService';
import UserAvatar from '../../common/UserAvatar';
import CreateGroupComponent from '../../groups/CreateGroupComponent';

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

const GroupsScreen = ({ navigation }) => {
  const { currentUser } = useAuth();
  
  const [groups, setGroups] = useState([]);
  const [myGroups, setMyGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState('my'); 
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300); 

    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    setLoading(true);
    try {
      const result = await groupService.getAllGroups(currentUser?.id || currentUser?._id);
      
      if (result.success) {
        const allGroups = result.data || [];
        
        const userGroups = allGroups.filter(group => 
          groupService.isMember(group, currentUser?.id || currentUser?._id)
        );
        
        const otherGroups = allGroups.filter(group => 
          !groupService.isMember(group, currentUser?.id || currentUser?._id)
        );

        setMyGroups(userGroups);
        
        // עבור discover - הראה רק 6 קבוצות רנדומליות
        const shuffled = otherGroups.sort(() => 0.5 - Math.random());
        const discoverGroups = shuffled.slice(0, 6);
        
        setGroups(discoverGroups);
      } else {
        Alert.alert('Error', result.message || 'Failed to load groups');
      }
    } catch (error) {
      console.error('Load groups error:', error);
      Alert.alert('Error', 'Failed to load groups');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadGroups();
  }, []);

  const handleJoinGroup = async (group) => {
    try {
      const result = await groupService.joinGroup(group._id, currentUser?.id || currentUser?._id);
      
      if (result.success) {
        if (result.data.status === 'pending') {
          Alert.alert('Request Sent', 'Your join request has been sent to the group admin');
        } else {
          Alert.alert('Success', 'You have joined the group successfully!');
          loadGroups(); 
        }
      } else {
        Alert.alert('Error', result.message || 'Failed to join group');
      }
    } catch (error) {
      console.error('Join group error:', error);
      Alert.alert('Error', 'Failed to join group');
    }
  };

  const handleCreateGroup = () => {
    setShowCreateModal(true);
  };

  const handleGroupCreated = (newGroup) => {
    setShowCreateModal(false);
    loadGroups(); 
  };

  const handleGroupPress = (group) => {
    navigation.navigate('GroupDetails', { groupId: group._id });
  };

  const refreshDiscoverGroups = async () => {
    try {
      const result = await groupService.getAllGroups(currentUser?.id || currentUser?._id);
      
      if (result.success) {
        const allGroups = result.data || [];
        const otherGroups = allGroups.filter(group => 
          !groupService.isMember(group, currentUser?.id || currentUser?._id)
        );
        
        // בחר 6 קבוצות רנדומליות חדשות
        const shuffled = otherGroups.sort(() => 0.5 - Math.random());
        const discoverGroups = shuffled.slice(0, 6);
        
        setGroups(discoverGroups);
      }
    } catch (error) {
      console.error('Refresh discover groups error:', error);
    }
  };

  const filteredGroups = useMemo(() => {
    const currentGroups = selectedTab === 'my' ? myGroups : groups;
    
    if (!debouncedSearchQuery.trim()) {
      return currentGroups;
    }

    const query = debouncedSearchQuery.toLowerCase();
    return currentGroups.filter(group =>
      group.name.toLowerCase().includes(query) ||
      group.description?.toLowerCase().includes(query) ||
      group.category.toLowerCase().includes(query) ||
      group.creatorName?.toLowerCase().includes(query)
    );
  }, [selectedTab, myGroups, groups, debouncedSearchQuery]);

  const renderGroupCard = ({ item: group }) => {
    const isMember = groupService.isMember(group, currentUser?.id || currentUser?._id);
    const isCreator = groupService.isCreator(group, currentUser?.id || currentUser?._id);
    const hasPendingRequest = groupService.hasPendingRequest(group, currentUser?.id || currentUser?._id);

    return (
      <TouchableOpacity 
        style={styles.groupCard}
        onPress={() => handleGroupPress(group)}
        activeOpacity={0.7}
      >
        <View style={styles.groupImageContainer}>
          {group.image ? (
            <Image source={{ uri: group.image }} style={styles.groupImage} />
          ) : (
            <View style={styles.placeholderGroupImage}>
              <Ionicons name="people" size={40} color={FLAVORWORLD_COLORS.textLight} />
            </View>
          )}
          
          <View style={[styles.privacyBadge, group.isPrivate && styles.privateBadge]}>
            <Ionicons 
              name={group.isPrivate ? "lock-closed" : "globe"} 
              size={12} 
              color={FLAVORWORLD_COLORS.white} 
            />
          </View>
        </View>

        <View style={styles.groupInfo}>
          <Text style={styles.groupName} numberOfLines={1}>
            {group.name}
          </Text>
          
          <Text style={styles.groupDescription} numberOfLines={2}>
            {group.description || 'No description available'}
          </Text>
          
          <View style={styles.groupStats}>
            <View style={styles.statItem}>
              <Ionicons name="people-outline" size={14} color={FLAVORWORLD_COLORS.textLight} />
              <Text style={styles.statText}>{group.membersCount || 0} members</Text>
            </View>
            
            <View style={styles.statItem}>
              <Ionicons name="restaurant-outline" size={14} color={FLAVORWORLD_COLORS.textLight} />
              <Text style={styles.statText}>{group.postsCount || 0} recipes</Text>
            </View>
          </View>

          <View style={styles.groupMeta}>
            <View style={styles.categoryTag}>
              <Text style={styles.categoryText}>{group.category}</Text>
            </View>
            
            <View style={styles.creatorInfo}>
              <UserAvatar
                uri={group.creatorAvatar}
                name={group.creatorName}
                size={16}
              />
              <Text style={styles.creatorText}>{group.creatorName}</Text>
            </View>
          </View>
        </View>

        <View style={styles.actionButton}>
          {isMember ? (
            <TouchableOpacity style={styles.memberButton}>
              <Ionicons name="checkmark" size={16} color={FLAVORWORLD_COLORS.success} />
              <Text style={styles.memberButtonText}>
                {isCreator ? 'Owner' : 'Member'}
              </Text>
            </TouchableOpacity>
          ) : hasPendingRequest ? (
            <TouchableOpacity style={styles.pendingButton}>
              <Ionicons name="time" size={16} color={FLAVORWORLD_COLORS.primary} />
              <Text style={styles.pendingButtonText}>Pending</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={styles.joinButton}
              onPress={() => handleJoinGroup(group)}
            >
              <Ionicons name="add" size={16} color={FLAVORWORLD_COLORS.white} />
              <Text style={styles.joinButtonText}>Join</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="people-outline" size={80} color={FLAVORWORLD_COLORS.textLight} />
      <Text style={styles.emptyTitle}>
        {selectedTab === 'my' ? 'No Groups Yet' : 'No New Groups to Discover'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {selectedTab === 'my' 
          ? 'Join cooking groups or create your own to share recipes with fellow food lovers!'
          : 'Great! You\'re already a member of all available groups. Check back later for new communities!'
        }
      </Text>
      {selectedTab === 'my' && (
        <TouchableOpacity style={styles.createGroupButton} onPress={handleCreateGroup}>
          <Text style={styles.createGroupButtonText}>Create Group</Text>
        </TouchableOpacity>
      )}
      {selectedTab === 'discover' && (
        <TouchableOpacity 
          style={styles.createGroupButton} 
          onPress={refreshDiscoverGroups}
        >
          <Text style={styles.createGroupButtonText}>Refresh</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderHeader = () => (
    <View style={styles.headerContent}>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={FLAVORWORLD_COLORS.textLight} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search groups..."
          placeholderTextColor={FLAVORWORLD_COLORS.textLight}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close" size={20} color={FLAVORWORLD_COLORS.textLight} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'my' && styles.activeTab]}
          onPress={() => setSelectedTab('my')}
        >
          <Text style={[styles.tabText, selectedTab === 'my' && styles.activeTabText]}>
            My Groups ({myGroups.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, selectedTab === 'discover' && styles.activeTab]}
          onPress={() => setSelectedTab('discover')}
        >
          <Text style={[styles.tabText, selectedTab === 'discover' && styles.activeTabText]}>
            Discover
          </Text>
        </TouchableOpacity>
      </View>

      {selectedTab === 'discover' && !searchQuery.trim() && (
        <TouchableOpacity 
          style={styles.refreshButton} 
          onPress={refreshDiscoverGroups}
        >
          <Ionicons name="refresh" size={16} color={FLAVORWORLD_COLORS.primary} />
          <Text style={styles.refreshButtonText}>Show Different Groups</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={FLAVORWORLD_COLORS.primary} />
          <Text style={styles.loadingText}>Loading groups...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={FLAVORWORLD_COLORS.accent} />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Groups</Text>
        
        <TouchableOpacity 
          style={styles.createButton}
          onPress={handleCreateGroup}
        >
          <Ionicons name="add" size={24} color={FLAVORWORLD_COLORS.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredGroups}
        keyExtractor={(item) => item._id}
        renderItem={renderGroupCard}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyState}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={onRefresh}
      />

      <Modal
        visible={showCreateModal}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <CreateGroupComponent
          navigation={{
            goBack: () => setShowCreateModal(false)
          }}
          onGroupCreated={handleGroupCreated}
        />
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
  },
  backButton: {
    padding: 8,
    backgroundColor: FLAVORWORLD_COLORS.background,
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: FLAVORWORLD_COLORS.text,
  },
  createButton: {
    padding: 8,
    backgroundColor: FLAVORWORLD_COLORS.background,
    borderRadius: 20,
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
  headerContent: {
    backgroundColor: FLAVORWORLD_COLORS.white,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: FLAVORWORLD_COLORS.border,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: FLAVORWORLD_COLORS.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: FLAVORWORLD_COLORS.text,
    marginLeft: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: FLAVORWORLD_COLORS.background,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: FLAVORWORLD_COLORS.white,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: FLAVORWORLD_COLORS.textLight,
  },
  activeTabText: {
    color: FLAVORWORLD_COLORS.primary,
    fontWeight: '600',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: FLAVORWORLD_COLORS.background,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: FLAVORWORLD_COLORS.primary,
  },
  refreshButtonText: {
    fontSize: 14,
    color: FLAVORWORLD_COLORS.primary,
    fontWeight: '500',
    marginLeft: 4,
  },
  listContainer: {
    padding: 16,
  },
  row: {
    justifyContent: 'space-between',
  },
  groupCard: {
    backgroundColor: FLAVORWORLD_COLORS.white,
    borderRadius: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    overflow: 'hidden',
    width: '48%',
  },
  groupImageContainer: {
    position: 'relative',
    height: 100,
  },
  groupImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholderGroupImage: {
    width: '100%',
    height: '100%',
    backgroundColor: FLAVORWORLD_COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  privacyBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: FLAVORWORLD_COLORS.secondary,
    borderRadius: 12,
    padding: 4,
  },
  privateBadge: {
    backgroundColor: FLAVORWORLD_COLORS.accent,
  },
  groupInfo: {
    padding: 12,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '600',
    color: FLAVORWORLD_COLORS.text,
    marginBottom: 4,
  },
  groupDescription: {
    fontSize: 12,
    color: FLAVORWORLD_COLORS.textLight,
    lineHeight: 16,
    marginBottom: 8,
  },
  groupStats: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  statText: {
    fontSize: 10,
    color: FLAVORWORLD_COLORS.textLight,
    marginLeft: 4,
  },
  groupMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryTag: {
    backgroundColor: FLAVORWORLD_COLORS.background,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  categoryText: {
    fontSize: 10,
    color: FLAVORWORLD_COLORS.secondary,
    fontWeight: '600',
  },
  creatorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  creatorText: {
    fontSize: 10,
    color: FLAVORWORLD_COLORS.textLight,
    marginLeft: 4,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: FLAVORWORLD_COLORS.primary,
    borderRadius: 12,
    paddingVertical: 8,
  },
  joinButtonText: {
    color: FLAVORWORLD_COLORS.white,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  memberButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: FLAVORWORLD_COLORS.background,
    borderRadius: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: FLAVORWORLD_COLORS.success,
  },
  memberButtonText: {
    color: FLAVORWORLD_COLORS.success,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  pendingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: FLAVORWORLD_COLORS.background,
    borderRadius: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: FLAVORWORLD_COLORS.primary,
  },
  pendingButtonText: {
    color: FLAVORWORLD_COLORS.primary,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: FLAVORWORLD_COLORS.text,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: FLAVORWORLD_COLORS.textLight,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  createGroupButton: {
    backgroundColor: FLAVORWORLD_COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  createGroupButtonText: {
    color: FLAVORWORLD_COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default GroupsScreen;