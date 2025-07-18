import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';

const EmailInput = ({ value, onChangeText, placeholder = 'Email', style }) => {
  const [error, setError] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!email || email.trim() === '') {
      setError('Please enter an email address');
      return false;
    } else if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return false;
    } else {
      setError('');
      return true;
    }
  };

  const handleChangeText = (text) => {
    onChangeText(text);
    if (text.length > 0) {
      validateEmail(text);
    } else {
      setError('');
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (value) {
      validateEmail(value);
    }
  };

  return (
    <View style={[styles.container, style]}>
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
        keyboardType="email-address"
        autoCapitalize="none"
        textContentType="emailAddress"
        autoComplete="email"
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: 15,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 15,
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
  errorText: {
    color: '#e74c3c',
    fontSize: 14,
    marginTop: 5,
  },
});

export default EmailInput;