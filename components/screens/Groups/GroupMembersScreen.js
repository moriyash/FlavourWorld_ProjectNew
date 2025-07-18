
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../services/AuthContext';
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
  warning: '#F39C12',
  info: '#3498DB'
};

const GroupMembersScreen = ({ route, navigation }) => {
  const { currentUser } = useAuth();
  const { groupId, groupName } = route.params;
  
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [filteredMembers, setFilteredMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [removingMemberId, setRemovingMemberId] = useState(null);

  const isAdmin = group ? groupService.isAdmin(group, currentUser?.id || currentUser?._id) : false;
  const isCreator = group ? groupService.isCreator(group, currentUser?.id || currentUser?._id) : false;
  const canManageMembers = isAdmin || isCreator;

  useEffect(() => {
    loadGroupData();
  }, [groupId]);

  useEffect(() => {
    filterMembers();
  }, [searchQuery, members]);

  const loadGroupData = useCallback(async () => {
    try {
      setLoading(true);
      
      const result = await groupService.getGroupWithMembers(groupId);
      
      if (result.success) {
        setGroup(result.data);
        setMembers(result.data.members || []);
        console.log('Group members loaded successfully');
      } else {
        Alert.alert('Error', result.message || 'Failed to load group members');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Load group members error occurred');
      Alert.alert('Error', 'Failed to load group members');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadGroupData().finally(() => setRefreshing(false));
  }, [loadGroupData]);

  const filterMembers = useCallback(() => {
    if (!searchQuery.trim()) {
      setFilteredMembers(members);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = members.filter(member => {
      const name = (member.userName || member.name || member.fullName || '').toLowerCase();
      const role = (member.role || 'member').toLowerCase();
      return name.includes(query) || role.includes(query);
    });

    setFilteredMembers(filtered);
  }, [searchQuery, members]);

  const handleRemoveMember = async (memberUserId, memberName) => {
    if (!canManageMembers) {
      Alert.alert('Permission Denied', 'Only admins can remove members');
      return;
    }

    if (memberUserId === (currentUser?.id || currentUser?._id)) {
      Alert.alert('Error', 'You cannot remove yourself. Use "Leave Group" instead.');
      return;
    }

    Alert.alert(
      'Remove Member',
      `Are you sure you want to remove ${memberName} from ${groupName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setRemovingMemberId(memberUserId);
            try {
              const result = await groupService.removeMember(
                groupId, 
                memberUserId, 
                currentUser?.id || currentUser?._id
              );
              
              if (result.success) {
                Alert.alert('Success', `${memberName} has been removed from the group`);
                loadGroupData(); 
              } else {
                Alert.alert('Error', result.message || 'Failed to remove member');
              }
            } catch (error) {
              console.error('Remove member error occurred');
              Alert.alert('Error', 'Failed to remove member');
            } finally {
              setRemovingMemberId(null);
            }
          }
        }
      ]
    );
  };

  const handlePromoteToAdmin = async (memberUserId, memberName) => {
    if (!isCreator) {
      Alert.alert('Permission Denied', 'Only the group creator can promote members to admin');
      return;
    }

    Alert.alert(
      'Promote to Admin',
      `Promote ${memberName} to group admin?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Promote',
          onPress: async () => {
            try {
              const result = await groupService.updateMemberRole(
                groupId, 
                memberUserId, 
                'admin',
                currentUser?.id || currentUser?._id
              );
              
              if (result.success) {
                Alert.alert('Success', `${memberName} is now a group admin`);
                loadGroupData();
              } else {
                Alert.alert('Error', result.message || 'Failed to promote member');
              }
            } catch (error) {
              console.error('Promote member error occurred');
              Alert.alert('Error', 'Failed to promote member');
            }
          }
        }
      ]
    );
  };

  const renderMemberItem = ({ item }) => {
    const memberId = item.userId || item._id || item.id;
    const memberName = item.userName || item.name || item.fullName || 'Unknown User';
    const memberEmail = item.userEmail || item.email || '';
    const memberRole = item.role || 'member';
    const joinDate = item.joinedAt ? new Date(item.joinedAt).toLocaleDateString() : 'Unknown';
    const isCurrentUser = memberId === (currentUser?.id || currentUser?._id);
    const canRemove = canManageMembers && !isCurrentUser && memberRole !== 'owner';
    const canPromote = isCreator && !isCurrentUser && memberRole === 'member';

    return (
      <View style={styles.memberItem}>
        <UserAvatar
          uri={item.userAvatar || item.avatar}
          name={memberName}
          size={50}
        />
        
        <View style={styles.memberInfo}>
          <Text style={styles.memberName}>
            {memberName}
            {isCurrentUser && ' (You)'}
          </Text>
          {memberEmail && (
            <Text style={styles.memberEmail}>{memberEmail}</Text>
          )}
          <View style={styles.memberMeta}>
            <Text style={styles.memberRole}>
              {memberRole === 'owner' ? 'Group Owner' : 
               memberRole === 'admin' ? 'Admin' : 'Member'}
            </Text>
            <Text style={styles.memberJoinDate}>Joined: {joinDate}</Text>
          </View>
        </View>

        {/**/}
        <View style={styles.badges}>
          {memberRole === 'owner' && (
            <View style={styles.ownerBadge}>
              <Text style={styles.badgeText}>OWNER</Text>
            </View>
          )}
          {memberRole === 'admin' && (
            <View style={styles.adminBadge}>
              <Text style={styles.badgeText}>ADMIN</Text>
            </View>
          )}
        </View>

        {/**/}
        <View style={styles.actionButtons}>
          {canPromote && (
            <TouchableOpacity
              style={styles.promoteButton}
              onPress={() => handlePromoteToAdmin(memberId, memberName)}
            >
              <Ionicons name="arrow-up" size={16} color={FLAVORWORLD_COLORS.info} />
            </TouchableOpacity>
          )}
          
          {canRemove && (
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => handleRemoveMember(memberId, memberName)}
              disabled={removingMemberId === memberId}
            >
              {removingMemberId === memberId ? (
                <ActivityIndicator size="small" color={FLAVORWORLD_COLORS.white} />
              ) : (
                <Ionicons name="person-remove" size={16} color={FLAVORWORLD_COLORS.white} />
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderEmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="people-outline" size={80} color={FLAVORWORLD_COLORS.textLight} />
      <Text style={styles.emptyTitle}>
        {searchQuery ? 'No members found' : 'No members yet'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {searchQuery 
          ? `No members match "${searchQuery}"`
          : 'This group has no members yet'
        }
      </Text>
    </View>
  );

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
          <Text style={styles.headerTitle}>Members</Text>
          <View style={styles.placeholder} />
        </View>
        
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={FLAVORWORLD_COLORS.primary} />
          <Text style={styles.loadingText}>Loading members...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/**/}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={FLAVORWORLD_COLORS.accent} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          Members ({filteredMembers.length})
        </Text>
        <View style={styles.placeholder} />
      </View>

      {/**/}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={FLAVORWORLD_COLORS.textLight} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search members..."
            placeholderTextColor={FLAVORWORLD_COLORS.textLight}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity 
              onPress={() => setSearchQuery('')}
              style={styles.clearButton}
            >
              <Ionicons name="close" size={20} color={FLAVORWORLD_COLORS.textLight} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/**/}
      <FlatList
        data={filteredMembers}
        keyExtractor={(item) => `${item.userId || item._id || Math.random()}`}
        renderItem={renderMemberItem}
        ListEmptyComponent={renderEmptyComponent}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={[FLAVORWORLD_COLORS.primary]}
            tintColor={FLAVORWORLD_COLORS.primary}
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={filteredMembers.length === 0 ? styles.emptyList : styles.list}
      />
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
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: FLAVORWORLD_COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: FLAVORWORLD_COLORS.border,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: FLAVORWORLD_COLORS.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: FLAVORWORLD_COLORS.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: FLAVORWORLD_COLORS.text,
    marginLeft: 8,
  },
  clearButton: {
    padding: 4,
  },
  list: {
    paddingVertical: 8,
  },
  emptyList: {
    flex: 1,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: FLAVORWORLD_COLORS.white,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: FLAVORWORLD_COLORS.border,
  },
  memberInfo: {
    flex: 1,
    marginLeft: 12,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: FLAVORWORLD_COLORS.text,
    marginBottom: 2,
  },
  memberEmail: {
    fontSize: 14,
    color: FLAVORWORLD_COLORS.textLight,
    marginBottom: 4,
  },
  memberMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  memberRole: {
    fontSize: 14,
    color: FLAVORWORLD_COLORS.accent,
    fontWeight: '500',
  },
  memberJoinDate: {
    fontSize: 12,
    color: FLAVORWORLD_COLORS.textLight,
  },
  badges: {
    marginRight: 8,
  },
  ownerBadge: {
    backgroundColor: FLAVORWORLD_COLORS.warning,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    marginBottom: 2,
  },
  adminBadge: {
    backgroundColor: FLAVORWORLD_COLORS.accent,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    marginBottom: 2,
  },
  badgeText: {
    color: FLAVORWORLD_COLORS.white,
    fontSize: 10,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  promoteButton: {
    padding: 8,
    backgroundColor: FLAVORWORLD_COLORS.info,
    borderRadius: 15,
  },
  removeButton: {
    padding: 8,
    backgroundColor: FLAVORWORLD_COLORS.danger,
    borderRadius: 15,
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: FLAVORWORLD_COLORS.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: FLAVORWORLD_COLORS.textLight,
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default GroupMembersScreen;