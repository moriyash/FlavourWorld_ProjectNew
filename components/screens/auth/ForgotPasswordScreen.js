import React, { useState } from 'react';
import {
  StyleSheet,
  SafeAreaView,
  View,
  Image,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { authService } from '../../../services/authService';
import EmailInput from '../../common/EmailInput';

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

const ForgotPasswordScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [isFormValid, setIsFormValid] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [emailExists, setEmailExists] = useState(null); 

  const handleEmailChange = (text) => {
    setEmail(text);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    setIsFormValid(emailRegex.test(text));
    
    setEmailExists(null);
  };

  const checkEmailExists = async () => {
    if (!isFormValid) return;

    setIsCheckingEmail(true);
    try {
      const result = await authService.checkEmailExists(email.trim());
      
      if (result.success) {
        setEmailExists(result.exists);
        if (!result.exists) {
          Alert.alert(
            'Email Not Found', 
            'This email address is not registered. Please check your email or register for a new account.',
            [
              {
                text: 'Register',
                onPress: () => navigation.navigate('Register')
              },
              {
                text: 'Try Again',
                style: 'cancel'
              }
            ]
          );
        }
      } else {
        Alert.alert('Error', 'Failed to verify email. Please try again.');
      }
    } catch (error) {
      Alert.alert('Error', 'Connection failed. Please try again.');
    } finally {
      setIsCheckingEmail(false);
    }
  };

  const handleResetPassword = async () => {
    if (!isFormValid) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    if (emailExists === null) {
      await checkEmailExists();
      if (emailExists === false) return; 
    }

    if (emailExists === false) {
      Alert.alert('Error', 'Please enter a registered email address');
      return;
    }

    setIsLoading(true);

    try {
      const result = await authService.sendPasswordResetCode(email.trim());

      if (result.success) {
        console.log('Reset code sent successfully');
        navigation.navigate('PasswordResetCode', {
          email: email.trim(),
          resetToken: result.resetToken || null
        });
      } else {
        Alert.alert('Error', result.message || 'Failed to send reset code');
      }
    } catch (error) {
      Alert.alert('Error', 'Connection failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getButtonText = () => {
    if (isLoading) return null; 
    if (isCheckingEmail) return 'Checking Email...';
    if (emailExists === null && isFormValid) return 'Continue';
    if (emailExists === true) return 'Send Reset Code';
    return 'Continue';
  };

  const isButtonDisabled = !isFormValid || isLoading || isCheckingEmail;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: FLAVORWORLD_COLORS.background }}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <View style={styles.logoBackground}>
              <Text style={styles.logoText}>🔐</Text>
            </View>
          </View>

          <Text style={styles.title}>
            Reset Password
          </Text>

          <Text style={styles.subtitle}>
            {resetSent 
              ? "Password reset instructions sent!" 
              : "Enter your email to receive a reset code"}
          </Text>
        </View>

        {!resetSent ? (
          <View style={styles.form}>
            <View style={styles.input}>
              <Text style={styles.inputLabel}>Email address</Text>
              <EmailInput
                value={email}
                onChangeText={handleEmailChange}
                placeholder="example@FlavorWorld.com"
                style={[
                  styles.emailInput,
                  emailExists === true && styles.emailInputValid,
                  emailExists === false && styles.emailInputInvalid
                ]}
              />
              
              {/**/}
              {emailExists === true && (
                <View style={styles.emailStatus}>
                  <Text style={styles.emailStatusTextValid}>✓ Email found</Text>
                </View>
              )}
              {emailExists === false && (
                <View style={styles.emailStatus}>
                  <Text style={styles.emailStatusTextInvalid}>✗ Email not registered</Text>
                </View>
              )}
            </View>

            <View style={styles.formAction}>
              <TouchableOpacity
                onPress={emailExists === null ? checkEmailExists : handleResetPassword}
                disabled={isButtonDisabled}
                style={[
                  styles.btn,
                  isButtonDisabled && styles.btnDisabled,
                  emailExists === true && styles.btnReady
                ]}
              >
                {(isLoading || isCheckingEmail) ? (
                  <ActivityIndicator size="small" color={FLAVORWORLD_COLORS.white} />
                ) : (
                  <Text style={styles.btnText}>{getButtonText()}</Text>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => {
                navigation.navigate('Login');
              }}>
              <Text style={styles.formLink}>Back to Login</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.successContainer}>
            <View style={styles.successIcon}>
              <Text style={styles.successEmoji}>✅</Text>
            </View>
            <Text style={styles.successMessage}>
              We've sent a reset code to {email}.
            </Text>
            <Text style={styles.successSubtext}>
              Check your inbox and enter the code in the next screen.
            </Text>
            <View style={styles.formAction}>
              <TouchableOpacity
                onPress={() => {
                  navigation.navigate('Login');
                }}>
                <View style={styles.btn}>
                  <Text style={styles.btnText}>Return to Login</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    padding: 24,
    backgroundColor: FLAVORWORLD_COLORS.background,
  },
  title: {
    fontSize: 31,
    fontWeight: '700',
    color: FLAVORWORLD_COLORS.accent,
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '500',
    color: FLAVORWORLD_COLORS.textLight,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 22,
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
  form: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
  },
  formAction: {
    marginTop: 16,
    marginBottom: 16,
  },
  formLink: {
    fontSize: 16,
    fontWeight: '600',
    color: FLAVORWORLD_COLORS.secondary,
    textAlign: 'center',
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
  emailInput: {
    backgroundColor: FLAVORWORLD_COLORS.white,
    borderColor: FLAVORWORLD_COLORS.border,
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: FLAVORWORLD_COLORS.text,
  },
  emailInputValid: {
    borderColor: FLAVORWORLD_COLORS.success,
    backgroundColor: '#F0FFF4',
  },
  emailInputInvalid: {
    borderColor: FLAVORWORLD_COLORS.danger,
    backgroundColor: '#FFF5F5',
  },
  emailStatus: {
    marginTop: 8,
    alignItems: 'flex-start',
  },
  emailStatusTextValid: {
    fontSize: 14,
    color: FLAVORWORLD_COLORS.success,
    fontWeight: '600',
  },
  emailStatusTextInvalid: {
    fontSize: 14,
    color: FLAVORWORLD_COLORS.danger,
    fontWeight: '600',
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: 0,
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
  btnReady: {
    backgroundColor: FLAVORWORLD_COLORS.success,
  },
  btnText: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '600',
    color: FLAVORWORLD_COLORS.white,
  },
  successContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: FLAVORWORLD_COLORS.white,
    borderRadius: 20,
    padding: 32,
    margin: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  successIcon: {
    marginBottom: 24,
  },
  successEmoji: {
    fontSize: 60,
  },
  successMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
    color: FLAVORWORLD_COLORS.text,
    fontWeight: '600',
    lineHeight: 22,
  },
  successSubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 30,
    color: FLAVORWORLD_COLORS.textLight,
    lineHeight: 20,
  },
});

export default ForgotPasswordScreen;