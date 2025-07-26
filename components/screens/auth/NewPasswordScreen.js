import React, { useState } from 'react';
import {
  StyleSheet,
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { authService } from '../../../services/authService';

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

const NewPasswordScreen = ({ route, navigation }) => {
  const { email, resetCode, verificationToken } = route.params;
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const validatePassword = (pass) => {
    const minLength = pass.length >= 8;
    const hasUpperCase = /[A-Z]/.test(pass);
    const hasLowerCase = /[a-z]/.test(pass);
    const hasNumbers = /\d/.test(pass);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(pass);

    return {
      minLength,
      hasUpperCase,
      hasLowerCase,
      hasNumbers,
      hasSpecialChar,
      isValid: minLength && hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar
    };
  };

  const passwordValidation = validatePassword(password);
  const passwordsMatch = password === confirmPassword && password.length > 0;
  const isFormValid = passwordValidation.isValid && passwordsMatch;

  const handleResetPassword = async () => {
    if (!isFormValid) {
      Alert.alert('Invalid Password', 'Please ensure your password meets all requirements and passwords match');
      return;
    }

    setIsLoading(true);
    try {
      const result = await authService.resetPasswordWithCode(
        email, 
        resetCode, 
        password, 
        verificationToken
      );
      
      if (result.success) {
        Alert.alert(
          'Success!', 
          'Your password has been reset successfully. You can now login with your new password.',
          [
            {
              text: 'Login Now',
              onPress: () => {
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'Login' }],
                });
              }
            }
          ]
        );
      } else {
        Alert.alert('Error', result.message || 'Failed to reset password');
      }
    } catch (error) {
      Alert.alert('Error', 'Connection failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderPasswordRequirement = (met, text) => (
    <View style={styles.requirementRow}>
      <Ionicons 
        name={met ? "checkmark-circle" : "close-circle"} 
        size={16} 
        color={met ? FLAVORWORLD_COLORS.success : FLAVORWORLD_COLORS.danger} 
      />
      <Text style={[
        styles.requirementText, 
        met ? styles.requirementMet : styles.requirementNotMet
      ]}>
        {text}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: FLAVORWORLD_COLORS.background }}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <View style={styles.logoBackground}>
              <Text style={styles.logoText}>🔑</Text>
            </View>
          </View>

          <Text style={styles.title}>Create New Password</Text>
          
          <Text style={styles.subtitle}>
            Create a strong password for your account
          </Text>
          <Text style={styles.emailText}>{email}</Text>
        </View>

        <View style={styles.form}>
          {/* New Password Input */}
          <View style={styles.input}>
            <Text style={styles.inputLabel}>New Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter new password"
                placeholderTextColor={FLAVORWORLD_COLORS.textLight}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons
                  name={showPassword ? "eye-off" : "eye"}
                  size={20}
                  color={FLAVORWORLD_COLORS.textLight}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Password Requirements */}
          {password.length > 0 && (
            <View style={styles.requirementsContainer}>
              <Text style={styles.requirementsTitle}>Password Requirements:</Text>
              {renderPasswordRequirement(passwordValidation.minLength, 'At least 8 characters')}
              {renderPasswordRequirement(passwordValidation.hasUpperCase, 'One uppercase letter')}
              {renderPasswordRequirement(passwordValidation.hasLowerCase, 'One lowercase letter')}
              {renderPasswordRequirement(passwordValidation.hasNumbers, 'One number')}
              {renderPasswordRequirement(passwordValidation.hasSpecialChar, 'One special character')}
            </View>
          )}

          {/* Confirm Password Input */}
          <View style={styles.input}>
            <Text style={styles.inputLabel}>Confirm Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[
                  styles.passwordInput,
                  confirmPassword.length > 0 && !passwordsMatch && styles.passwordInputError,
                  confirmPassword.length > 0 && passwordsMatch && styles.passwordInputSuccess
                ]}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm new password"
                placeholderTextColor={FLAVORWORLD_COLORS.textLight}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                <Ionicons
                  name={showConfirmPassword ? "eye-off" : "eye"}
                  size={20}
                  color={FLAVORWORLD_COLORS.textLight}
                />
              </TouchableOpacity>
            </View>
            
            {/* Password Match Indicator */}
            {confirmPassword.length > 0 && (
              <View style={styles.matchContainer}>
                <Ionicons 
                  name={passwordsMatch ? "checkmark-circle" : "close-circle"} 
                  size={16} 
                  color={passwordsMatch ? FLAVORWORLD_COLORS.success : FLAVORWORLD_COLORS.danger} 
                />
                <Text style={[
                  styles.matchText,
                  passwordsMatch ? styles.matchTextSuccess : styles.matchTextError
                ]}>
                  {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.formAction}>
            <TouchableOpacity
              onPress={handleResetPassword}
              disabled={!isFormValid || isLoading}
              style={[
                styles.btn,
                (!isFormValid || isLoading) && styles.btnDisabled
              ]}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={FLAVORWORLD_COLORS.white} />
              ) : (
                <Text style={styles.btnText}>Reset Password</Text>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>← Back to Code</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    backgroundColor: FLAVORWORLD_COLORS.background,
  },
  header: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 36,
  },
  logoContainer: {
    marginBottom: 36,
  },
  logoBackground: {
    width: 100,
    height: 100,
    backgroundColor: FLAVORWORLD_COLORS.white,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    borderWidth: 3,
    borderColor: FLAVORWORLD_COLORS.secondary,
  },
  logoText: {
    fontSize: 40,
  },
  title: {
    fontSize: 31,
    fontWeight: '700',
    color: FLAVORWORLD_COLORS.accent,
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '500',
    color: FLAVORWORLD_COLORS.textLight,
    textAlign: 'center',
    lineHeight: 22,
  },
  emailText: {
    fontSize: 16,
    fontWeight: '600',
    color: FLAVORWORLD_COLORS.accent,
    textAlign: 'center',
    marginTop: 8,
  },
  form: {
    flexGrow: 1,
  },
  input: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: FLAVORWORLD_COLORS.text,
    marginBottom: 8,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: FLAVORWORLD_COLORS.white,
    borderColor: FLAVORWORLD_COLORS.border,
    borderWidth: 2,
    borderRadius: 12,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: FLAVORWORLD_COLORS.text,
  },
  passwordInputError: {
    backgroundColor: '#FFF5F5',
  },
  passwordInputSuccess: {
    backgroundColor: '#F0FFF4',
  },
  eyeButton: {
    padding: 12,
  },
  requirementsContainer: {
    backgroundColor: FLAVORWORLD_COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: FLAVORWORLD_COLORS.border,
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: FLAVORWORLD_COLORS.text,
    marginBottom: 8,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  requirementText: {
    fontSize: 13,
    marginLeft: 8,
  },
  requirementMet: {
    color: FLAVORWORLD_COLORS.success,
  },
  requirementNotMet: {
    color: FLAVORWORLD_COLORS.danger,
  },
  matchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  matchText: {
    fontSize: 14,
    marginLeft: 8,
    fontWeight: '500',
  },
  matchTextSuccess: {
    color: FLAVORWORLD_COLORS.success,
  },
  matchTextError: {
    color: FLAVORWORLD_COLORS.danger,
  },
  formAction: {
    marginTop: 24,
    marginBottom: 16,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: FLAVORWORLD_COLORS.primary,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  btnDisabled: {
    backgroundColor: FLAVORWORLD_COLORS.textLight,
    elevation: 0,
    shadowOpacity: 0,
  },
  btnText: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '600',
    color: FLAVORWORLD_COLORS.white,
  },
  backButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: FLAVORWORLD_COLORS.textLight,
  },
});

export default NewPasswordScreen;