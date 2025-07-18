
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TouchableOpacity,
  Image,
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
};

const GroupAdminRequestsScreen = ({ route, navigation }) => {
  const { currentUser } = useAuth();
  const { groupId, groupName } = route.params;
  
  const [group, setGroup] = useState(null);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingRequests, setProcessingRequests] = useState(new Set());

  useEffect(() => {
    loadGroupData();
  }, [groupId]);

  const loadGroupData = useCallback(async () => {
    try {
      setLoading(true);
      
      const groupResult = await groupService.getGroup(groupId);
      if (groupResult.success) {
        setGroup(groupResult.data);
        
        const isAdmin = groupService.isAdmin(groupResult.data, currentUser?.id || currentUser?._id);
        const isCreator = groupService.isCreator(groupResult.data, currentUser?.id || currentUser?._id);
        
        console.log('🔍 Admin check:', { isAdmin, isCreator, userId: currentUser?.id || currentUser?._id });
        
        if (!isAdmin && !isCreator) {
          Alert.alert('Access Denied', 'Only group admins can manage join requests');
          navigation.goBack();
          return;
        }
        
        const requestsWithDetails = groupResult.data.pendingRequestsDetails || [];
        
        console.log('📋 Pending requests loaded:', {
          totalRequests: requestsWithDetails.length,
          requestsData: requestsWithDetails.map(r => ({
            userId: r.userId,
            userName: r.userName,
            hasAvatar: !!r.userAvatar
          }))
        });
        
        setPendingRequests(requestsWithDetails);
        
      } else {
        Alert.alert('Error', groupResult.message || 'Failed to load group');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Load group data error:', error);
      Alert.alert('Error', 'Failed to load group data');
    } finally {
      setLoading(false);
    }
  }, [groupId, currentUser, navigation]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadGroupData().finally(() => setRefreshing(false));
  }, [loadGroupData]);

  const handleRequest = async (request, action) => {
    const requestId = request.userId || request._id || request.id;
    
    if (processingRequests.has(requestId)) {
      return; 
    }

    setProcessingRequests(prev => new Set([...prev, requestId]));

    try {
      const result = await groupService.handleJoinRequest(
        groupId, 
        requestId, 
        action, 
        currentUser?.id || currentUser?._id
      );
      
      if (result.success) {
        setPendingRequests(prev => 
          prev.filter(req => {
            const reqId = req.userId || req._id || req.id;
            return reqId !== requestId;
          })
        );
        
        const actionText = action === 'approve' ? 'approved' : 'rejected';
        const userName = request.userName || request.fullName || request.name || 'User';
        Alert.alert('Success', `${userName}'s request has been ${actionText}`);
        
      } else {
        Alert.alert('Error', result.message || `Failed to ${action} request`);
      }
    } catch (error) {
      console.error(`Handle ${action} request error:`, error);
      Alert.alert('Error', `Failed to ${action} request`);
    } finally {
      setProcessingRequests(prev => {
        const newSet = new Set(prev);
        newSet.delete(requestId);
        return newSet;
      });
    }
  };

  const renderRequestItem = ({ item: request }) => {
    const requestId = request.userId || request._id || request.id;
    const isProcessing = processingRequests.has(requestId);
    const userName = request.userName || request.fullName || request.name || 'Unknown User';
    const userAvatar = request.userAvatar || request.avatar;
    const userBio = request.userBio || request.bio;
    const requestDate = request.createdAt || request.requestDate;

    return (
      <View style={styles.requestItem}>
        <View style={styles.userInfo}>
          <UserAvatar
            uri={userAvatar}
            name={userName}
            size={50}
          />
          
          <View style={styles.userDetails}>
            <Text style={styles.userName}>{userName}</Text>
            {userBio && (
              <Text style={styles.userBio} numberOfLines={2}>{userBio}</Text>
            )}
            {requestDate && (
              <Text style={styles.requestDate}>
                Requested {new Date(requestDate).toLocaleDateString()}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.approveButton, isProcessing && styles.disabledButton]}
            onPress={() => handleRequest(request, 'approve')}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color={FLAVORWORLD_COLORS.white} />
            ) : (
              <>
                <Ionicons name="checkmark" size={18} color={FLAVORWORLD_COLORS.white} />
                <Text style={styles.approveButtonText}>Approve</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.rejectButton, isProcessing && styles.disabledButton]}
            onPress={() => handleRequest(request, 'reject')}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color={FLAVORWORLD_COLORS.white} />
            ) : (
              <>
                <Ionicons name="close" size={18} color={FLAVORWORLD_COLORS.white} />
                <Text style={styles.rejectButtonText}>Reject</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderEmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIcon}>
        <Ionicons name="people-outline" size={80} color={FLAVORWORLD_COLORS.textLight} />
      </View>
      <Text style={styles.emptyTitle}>No Pending Requests</Text>
      <Text style={styles.emptySubtitle}>
        There are no join requests waiting for approval
      </Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={FLAVORWORLD_COLORS.primary} />
          <Text style={styles.loadingText}>Loading requests...</Text>
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
        
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Join Requests</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {groupName || 'Group Management'}
          </Text>
        </View>
        
        <View style={styles.headerCounter}>
          <View style={styles.counterBadge}>
            <Text style={styles.counterText}>{pendingRequests.length}</Text>
          </View>
        </View>
      </View>

      {/**/}
      {pendingRequests.length > 0 && (
        <View style={styles.summaryCard}>
          <View style={styles.summaryIcon}>
            <Ionicons name="time-outline" size={24} color={FLAVORWORLD_COLORS.warning} />
          </View>
          <View style={styles.summaryText}>
            <Text style={styles.summaryTitle}>
              {pendingRequests.length} request{pendingRequests.length !== 1 ? 's' : ''} pending
            </Text>
            <Text style={styles.summarySubtitle}>
              Review and approve new members for your group
            </Text>
          </View>
        </View>
      )}

      {/**/}
      <FlatList
        data={pendingRequests}
        keyExtractor={(item) => item.userId || item._id || item.id || Math.random().toString()}
        renderItem={renderRequestItem}
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
        contentContainerStyle={styles.listContainer}
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
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  backButton: {
    padding: 8,
    backgroundColor: FLAVORWORLD_COLORS.background,
    borderRadius: 20,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: FLAVORWORLD_COLORS.text,
  },
  headerSubtitle: {
    fontSize: 14,
    color: FLAVORWORLD_COLORS.textLight,
    marginTop: 2,
  },
  headerCounter: {
    width: 40,
    alignItems: 'flex-end',
  },
  counterBadge: {
    backgroundColor: FLAVORWORLD_COLORS.warning,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 24,
    alignItems: 'center',
  },
  counterText: {
    color: FLAVORWORLD_COLORS.white,
    fontSize: 12,
    fontWeight: '600',
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
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: FLAVORWORLD_COLORS.white,
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: FLAVORWORLD_COLORS.warning,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  summaryIcon: {
    marginRight: 16,
  },
  summaryText: {
    flex: 1,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: FLAVORWORLD_COLORS.text,
    marginBottom: 4,
  },
  summarySubtitle: {
    fontSize: 14,
    color: FLAVORWORLD_COLORS.textLight,
    lineHeight: 18,
  },
  listContainer: {
    flexGrow: 1,
    paddingHorizontal: 16,
  },
  requestItem: {
    backgroundColor: FLAVORWORLD_COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  userDetails: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: FLAVORWORLD_COLORS.text,
    marginBottom: 4,
  },
  userBio: {
    fontSize: 14,
    color: FLAVORWORLD_COLORS.textLight,
    lineHeight: 18,
    marginBottom: 4,
  },
  requestDate: {
    fontSize: 12,
    color: FLAVORWORLD_COLORS.textLight,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  approveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: FLAVORWORLD_COLORS.success,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginRight: 8,
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: FLAVORWORLD_COLORS.danger,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginLeft: 8,
  },
  disabledButton: {
    opacity: 0.6,
  },
  approveButtonText: {
    color: FLAVORWORLD_COLORS.white,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  rejectButtonText: {
    color: FLAVORWORLD_COLORS.white,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    marginBottom: 20,
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: FLAVORWORLD_COLORS.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: FLAVORWORLD_COLORS.textLight,
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default GroupAdminRequestsScreen;