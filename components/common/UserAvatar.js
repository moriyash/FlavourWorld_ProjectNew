
import React, { useState } from 'react';
import { View, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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

const UserAvatar = ({ 
  uri, 
  name = 'Anonymous', 
  size = 40, 
  onPress = null,
  showOnlineStatus = false,
  isOnline = false,
  style = {}
}) => {
  const [imageError, setImageError] = useState(false);
  
  const handleImageError = () => {
    setImageError(true);
  };

  const renderAvatar = () => {
    if (uri && !imageError) {
      return (
        <Image
          source={{ uri }}
          style={[
            styles.image,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
            }
          ]}
          onError={handleImageError}
        />
      );
    } else {
      return (
        <View style={[
          styles.defaultAvatar,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
          }
        ]}>
          <View style={styles.defaultAvatarInner}>
            <Ionicons 
              name="person" 
              size={size * 0.6} 
              color={FLAVORWORLD_COLORS.textLight} 
            />
          </View>
        </View>
      );
    }
  };

  if (onPress) {
    return (
      <TouchableOpacity 
        style={[styles.container, style]} 
        onPress={onPress}
        activeOpacity={0.7}
      >
        <View style={styles.avatarContainer}>
          {renderAvatar()}
          {showOnlineStatus && (
            <View style={[
              styles.onlineIndicator,
              { backgroundColor: isOnline ? FLAVORWORLD_COLORS.success : FLAVORWORLD_COLORS.textLight }
            ]} />
          )}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <View style={styles.avatarContainer}>
        {renderAvatar()}
        {showOnlineStatus && (
          <View style={[
            styles.onlineIndicator,
            { backgroundColor: isOnline ? FLAVORWORLD_COLORS.success : FLAVORWORLD_COLORS.textLight }
          ]} />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  avatarContainer: {
    position: 'relative',
  },
  image: {
    borderWidth: 2,
    borderColor: FLAVORWORLD_COLORS.primary,
  },
  defaultAvatar: {
    backgroundColor: '#D6D8DB',
    borderWidth: 2,
    borderColor: FLAVORWORLD_COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  defaultAvatarInner: {
    backgroundColor: '#EAECEF',
    width: '80%',
    height: '80%',
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: FLAVORWORLD_COLORS.white,
  },
});

export default UserAvatar;