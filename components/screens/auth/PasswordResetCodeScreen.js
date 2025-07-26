import React, { useState, useEffect, useRef } from 'react';
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

const PasswordResetCodeScreen = ({ route, navigation }) => {
  const { email, resetToken } = route.params;
  
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);
  
  const inputRefs = useRef([]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleCodeChange = (text, index) => {
    const newCode = [...code];
    newCode[index] = text;
    setCode(newCode);

    if (text && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const isCodeComplete = code.every(digit => digit.length === 1);
  const fullCode = code.join('');

  const handleVerifyCode = async () => {
    if (!isCodeComplete) {
      Alert.alert('Incomplete Code', 'Please enter the complete 6-digit code');
      return;
    }

    setIsLoading(true);
    try {
      const result = await authService.verifyResetCode(email, fullCode);
      
      if (result.success) {
        navigation.navigate('NewPassword', {
          email: email,
          resetCode: fullCode,
          verificationToken: result.verificationToken
        });
      } else {
        Alert.alert('Invalid Code', result.message || 'The code you entered is incorrect or expired');
        setCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch (error) {
      console.error('Verify code error:', error);
      Alert.alert('Error', 'Connection failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0) return;

    setIsResending(true);
    try {
      const result = await authService.sendPasswordResetCode(email);
      
      if (result.success) {
        Alert.alert('Code Sent', 'A new reset code has been sent to your email');
        setResendCooldown(60); 
        setCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      } else {
        Alert.alert('Error', result.message || 'Failed to resend code');
      }
    } catch (error) {
      console.error('Resend code error:', error);
      Alert.alert('Error', 'Connection failed. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: FLAVORWORLD_COLORS.background }}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <View style={styles.logoBackground}>
              <Text style={styles.logoText}>📧</Text>
            </View>
          </View>

          <Text style={styles.title}>Enter Reset Code</Text>
          
          <Text style={styles.subtitle}>
            We've sent a 6-digit code to
          </Text>
          <Text style={styles.emailText}>{email}</Text>
          <Text style={styles.subtitle}>
            Enter the code below to continue
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.codeContainer}>
            {code.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => inputRefs.current[index] = ref}
                style={[
                  styles.codeInput,
                  digit ? styles.codeInputFilled : null
                ]}
                value={digit}
                onChangeText={(text) => handleCodeChange(text, index)}
                onKeyPress={(e) => handleKeyPress(e, index)}
                maxLength={1}
                keyboardType="numeric"
                textAlign="center"
                autoFocus={index === 0}
                selectTextOnFocus
              />
            ))}
          </View>

          <View style={styles.formAction}>
            <TouchableOpacity
              onPress={handleVerifyCode}
              disabled={!isCodeComplete || isLoading}
              style={[
                styles.btn,
                (!isCodeComplete || isLoading) && styles.btnDisabled
              ]}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={FLAVORWORLD_COLORS.white} />
              ) : (
                <Text style={styles.btnText}>Verify Code</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.resendContainer}>
            <Text style={styles.resendText}>Didn't receive the code?</Text>
            <TouchableOpacity
              onPress={handleResendCode}
              disabled={resendCooldown > 0 || isResending}
              style={styles.resendButton}
            >
              {isResending ? (
                <ActivityIndicator size="small" color={FLAVORWORLD_COLORS.secondary} />
              ) : (
                <Text style={[
                  styles.resendButtonText,
                  (resendCooldown > 0) && styles.resendButtonTextDisabled
                ]}>
                  {resendCooldown > 0 
                    ? `Resend in ${resendCooldown}s` 
                    : 'Resend Code'
                  }
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>← Back to Email</Text>
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
    marginVertical: 8,
  },
  form: {
    flexGrow: 1,
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginVertical: 32,
  },
  codeInput: {
    width: 50,
    height: 60,
    backgroundColor: FLAVORWORLD_COLORS.white,
    borderColor: FLAVORWORLD_COLORS.border,
    borderWidth: 2,
    borderRadius: 12,
    fontSize: 24,
    fontWeight: '600',
    color: FLAVORWORLD_COLORS.text,
    textAlign: 'center',
  },
  codeInputFilled: {
    borderColor: FLAVORWORLD_COLORS.primary,
    backgroundColor: '#FFF9E6',
  },
  formAction: {
    marginTop: 16,
    marginBottom: 24,
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
  resendContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  resendText: {
    fontSize: 14,
    color: FLAVORWORLD_COLORS.textLight,
    marginBottom: 8,
  },
  resendButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  resendButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: FLAVORWORLD_COLORS.secondary,
  },
  resendButtonTextDisabled: {
    color: FLAVORWORLD_COLORS.textLight,
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

export default PasswordResetCodeScreen;