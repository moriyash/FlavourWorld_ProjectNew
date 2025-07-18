
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const FLAVORWORLD_COLORS = {
  primary: '#F5A623',
  secondary: '#4ECDC4',
  accent: '#1F3A93',
  background: '#FFF8F0',
  white: '#FFFFFF',
  text: '#2C3E50',
  textLight: '#7F8C8D',
  border: '#E8E8E8',
};

const DefaultAvatar = ({ 
  size = 40, 
  name = 'Anonymous', 
  backgroundColor = '#E8E8E8',
  textColor = '#7F8C8D'
}) => {
  const firstLetter = name ? name.charAt(0).toUpperCase() : 'A';
  
  return (
    <View style={[
      styles.avatar,
      {
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: backgroundColor
      }
    ]}>
      <Text style={[
        styles.avatarText,
        {
          fontSize: size * 0.4,
          color: textColor
        }
      ]}>
        {firstLetter}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  avatar: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: FLAVORWORLD_COLORS.primary,
  },
  avatarText: {
    fontWeight: '600',
  },
});

export default DefaultAvatar;