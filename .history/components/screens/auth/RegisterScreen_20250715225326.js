import React, { useState } from 'react';
import {
  StyleSheet,
  SafeAreaView,
  View,
  Image,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { authService } from '../../../services/authService';
import PasswordInput from '../../common/PasswordInput';
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

const RegisterScreen = ({ navigation }) => {
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [errors, setErrors] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [isLoading, setIsLoading] = useState(false);

  const validateFullName = (name) => {
    if (!name || name.trim() === '') return 'Please enter your full name';
    if (name.trim().length < 3) return 'Name must be at least 3 characters';
    return '';
  };

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || email.trim() === '') return 'Please enter an email address';
    if (!emailRegex.test(email)) return 'Please enter a valid email address';
    return '';
  };

  const validatePassword = (password) => {
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z]).{8,}$/;

    if (!password || password.trim() === '') return 'Please enter a password';
    if (!passwordRegex.test(password)) {
      return 'Password must contain at least 8 characters, including uppercase, lowercase, number, and special character';
    }
    return '';
  };

  const validateConfirmPassword = (password, confirmPassword) => {
    if (!confirmPassword || confirmPassword.trim() === '') return 'Please confirm your password';
    if (password !== confirmPassword) return 'Passwords do not match';
    return '';
  };

  const validateForm = () => {
    const newErrors = {
      fullName: validateFullName(form.fullName),
      email: validateEmail(form.email),
      password: validatePassword(form.password),
      confirmPassword: validateConfirmPassword(form.password, form.confirmPassword),
    };

    setErrors(newErrors);

    return !Object.values(newErrors).some(error => error !== '');
  };

  const handleInputChange = (field, value) => {
    setForm({ ...form, [field]: value });
    if (errors[field]) {
      setErrors({ ...errors, [field]: '' });
    }
  };

  const handleEmailChange = (text) => {
    handleInputChange('email', text);
  };

  const handlePasswordChange = (text) => {
    handleInputChange('password', text);
    if (form.confirmPassword) {
      setErrors({
        ...errors,
        confirmPassword: validateConfirmPassword(text, form.confirmPassword),
      });
    }
  };

  const handleConfirmPasswordChange = (text) => {
    handleInputChange('confirmPassword', text);
  };

  const handleRegister = async () => {
    if (!validateForm()) {
      Alert.alert('Error', 'Please fill in all fields correctly.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await authService.register({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        password: form.password,
        confirmPassword: form.confirmPassword
      });

      if (result.success) {
        Alert.alert(
          'Welcome to FlavorWorld! ', 
          'Registration completed successfully!', 
          [{ text: 'Start Cooking!'}]
        );
      } else {
        Alert.alert('Registration Failed', result.message);
      }
    } catch (error) {
      Alert.alert('Error', 'Connection failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: FLAVORWORLD_COLORS.background }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <View style={styles.logoBackground}>
                <Text style={styles.logoText}>👨‍🍳</Text>
              </View>
            </View>
            
            <Text style={styles.title}>Join FlavorWorld</Text>
            <Text style={styles.subtitle}>Create your account and start sharing delicious recipes</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.input}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <TextInput
                autoCorrect={false}
                onChangeText={(text) => handleInputChange('fullName', text)}
                placeholder="Chef's Name"
                placeholderTextColor={FLAVORWORLD_COLORS.textLight}
                style={[
                  styles.inputControl,
                  errors.fullName ? styles.inputError : null
                ]}
                value={form.fullName}
              />
              {errors.fullName && <Text style={styles.errorText}>{errors.fullName}</Text>}
            </View>

            <View style={styles.input}>
              <Text style={styles.inputLabel}>Email address</Text>
              <EmailInput
                value={form.email}
                onChangeText={handleEmailChange}
                placeholder="chef@FlavorWorld.com"
                style={styles.emailInput}
              />
              {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
            </View>

            <View style={styles.input}>
              <Text style={styles.inputLabel}>Password</Text>
              <PasswordInput
                value={form.password}
                onChangeText={handlePasswordChange}
                placeholder="Create a strong password"
                style={styles.passwordInput}
              />
              {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
            </View>

            <View style={styles.input}>
              <Text style={styles.inputLabel}>Confirm Password</Text>
              <PasswordInput
                value={form.confirmPassword}
                onChangeText={handleConfirmPasswordChange}
                placeholder="Confirm your password"
                isConfirmation={true}
                style={styles.passwordInput}
              />
              {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}
            </View>

            <View style={styles.formAction}>
              <TouchableOpacity 
                onPress={handleRegister}
                disabled={isLoading}
                style={[
                  styles.btn,
                  isLoading && styles.btnDisabled
                ]}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color={FLAVORWORLD_COLORS.white} />
                ) : (
                  <Text style={styles.btnText}>Join the Community</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.termsContainer}>
              <Text style={styles.termsText}>
                By creating an account, you agree to our{' '}
                <Text style={styles.termsLink}>Terms of Service</Text> and{' '}
                <Text style={styles.termsLink}>Privacy Policy</Text>
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={styles.formFooter}>
            Already have an account?{' '}
            <Text style={{ textDecorationLine: 'underline', color: FLAVORWORLD_COLORS.secondary }}>
              Sign in to FlavorWorld
            </Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
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
    marginVertical: 24,
  },
  logoContainer: {
    marginBottom: 24,
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
    borderColor: FLAVORWORLD_COLORS.primary,
  },
  logoText: {
    fontSize: 40,
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
  inputControl: {
    height: 50,
    backgroundColor: FLAVORWORLD_COLORS.white,
    paddingHorizontal: 16,
    borderRadius: 12,
    fontSize: 15,
    fontWeight: '500',
    color: FLAVORWORLD_COLORS.text,
    borderWidth: 2,
    borderColor: FLAVORWORLD_COLORS.border,
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
  passwordInput: {
    backgroundColor: FLAVORWORLD_COLORS.white,
    borderColor: FLAVORWORLD_COLORS.border,
    borderWidth: 2,
    borderRadius: 12,
  },
  inputError: {
    borderColor: FLAVORWORLD_COLORS.danger,
  },
  errorText: {
    color: FLAVORWORLD_COLORS.danger,
    fontSize: 14,
    marginTop: 5,
    fontWeight: '500',
  },
  formAction: {
    marginTop: 20,
    marginBottom: 16,
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
  btnText: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '600',
    color: FLAVORWORLD_COLORS.white,
  },
  termsContainer: {
    marginTop: 16,
    paddingHorizontal: 8,
  },
  termsText: {
    fontSize: 13,
    color: FLAVORWORLD_COLORS.textLight,
    textAlign: 'center',
    lineHeight: 18,
  },
  termsLink: {
    color: FLAVORWORLD_COLORS.secondary,
    fontWeight: '600',
  },
  formFooter: {
    paddingVertical: 24,
    fontSize: 15,
    fontWeight: '600',
    color: FLAVORWORLD_COLORS.text,
    textAlign: 'center',
    letterSpacing: 0.15,
    backgroundColor: FLAVORWORLD_COLORS.white,
    marginHorizontal: -24,
    paddingHorizontal: 24,
    borderTopWidth: 1,
    borderTopColor: FLAVORWORLD_COLORS.border,
  },
});

export default RegisterScreen;