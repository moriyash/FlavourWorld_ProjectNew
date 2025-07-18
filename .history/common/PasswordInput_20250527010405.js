import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const PasswordInput = ({ value, onChangeText, placeholder = 'Password', style, isConfirmation = false }) => {
  const [error, setError] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const validatePassword = (password) => {
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z]).{8,}$/;
    
    if (!password || password.trim() === '') {
      setError('Please enter a password');
      return false;
    } else if (!passwordRegex.test(password)) {
      setError('Password must contain at least 8 characters, including uppercase and lowercase letters, a number and a special character');
      return false;
    } else {
      setError('');
      return true;
    }
  };

  const handleChangeText = (text) => {
    onChangeText(text);
    if (text.length > 0 && !isConfirmation) {
      validatePassword(text);
    } else {
      setError('');
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (value && !isConfirmation) {
      validatePassword(value);
    }
  };

  const togglePasswordVisibility = () => {
    setIsPasswordVisible(!isPasswordVisible);
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.inputContainer}>
        <TextInput
          style={[
            styles.input,
            isFocused && styles.inputFocused,
            error ? styles.inputError : null
          ]}
          value={value}
          onChangeText={handleChangeText}
          onFocus={() => setIsFocused(true)}
          onBlur={handleBlur}
          placeholder={placeholder}
          secureTextEntry={!isPasswordVisible}
          textContentType={isConfirmation ? "newPassword" : "password"}
          autoComplete="password"
        />
        <TouchableOpacity 
          style={styles.visibilityIcon} 
          onPress={togglePasswordVisibility}
        >
          <Ionicons 
            name={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'} 
            size={24} 
            color="#777" 
          />
        </TouchableOpacity>
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: 15,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  input: {
    flex: 1,
    height: 50,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingRight: 50,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  inputFocused: {
    borderColor: '#4a90e2',
    borderWidth: 2,
  },
  inputError: {
    borderColor: '#e74c3c',
  },
  visibilityIcon: {
    position: 'absolute',
    right: 15,
  },
  errorText: {
    color: '#e74c3c',
    fontSize: 14,
    marginTop: 5,
  },
});

export default PasswordInput;