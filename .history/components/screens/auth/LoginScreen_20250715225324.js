import React, { useState } from 'react';
import {
  StyleSheet,
  SafeAreaView,
  View,
  Image,
  Text,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { authService } from '../../../services/authService';
import { useAuth } from '../../../services/AuthContext';

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

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();

  const [form, setForm] = useState({
    email: '',
    password: '',
  });
  
  const [isFormValid, setIsFormValid] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!email || email.trim() === '') {
      setEmailError('Please enter an email address');
      return false;
    } else if (!emailRegex.test(email)) {
      setEmailError('Please enter a valid email address');
      return false;
    } else {
      setEmailError('');
      return true;
    }
  };
  
  const validatePassword = (password) => {
    if (!password || password.trim() === '') {
      setPasswordError('Please enter a password');
      return false;
    } else {
      setPasswordError('');
      return true;
    }
  };

  const validateForm = () => {
    const isEmailValid = validateEmail(form.email);
    const isPasswordValid = validatePassword(form.password);
    return isEmailValid && isPasswordValid;
  };
  
  const handleEmailChange = (text) => {
    setForm({ ...form, email: text });
    const isEmailValid = validateEmail(text);
    const isPasswordValid = form.password.length > 0 && !passwordError;
    setIsFormValid(isEmailValid && isPasswordValid);
  };
  
  const handlePasswordChange = (text) => {
    setForm({ ...form, password: text });
    const isPasswordValid = validatePassword(text);
    const isEmailValid = form.email.length > 0 && !emailError;
    setIsFormValid(isEmailValid && isPasswordValid);
  };
  
  const handleLogin = async () => {
    console.log(' Login button pressed!');
    console.log(' Form data:', form);
    
    if (!validateForm()) {
      console.log(' Form validation failed');
      return;
    }
    
    setIsLoading(true);
    
    try {
      console.log(' Calling authService.login...');
      const result = await authService.login({ 
        email: form.email, 
        password: form.password 
      });
      
      console.log(' AuthService result:', result);
      
      if (result.success) {
        console.log(' Login successful, processing data...');
        
        const { token, user } = result.data;
        console.log(' Token:', token);
        console.log(' User:', user);
        
        if (token && user) {
          console.log(' Calling context login...');
          await login(token, user);
          console.log(' Context login completed');
          
          Alert.alert('Welcome!', `Hello ${user.fullName || user.name || 'Chef'}!`);
        } else {
          console.log(' Missing token or user data');
          Alert.alert('Error', 'Invalid response from server');
        }
      } else {
        console.log(' Login failed:', result.message);
        Alert.alert('Login Failed', result.message);
      }
    } catch (error) {
      console.error(' Login error:', error);
      Alert.alert('Error', 'Login failed. Please try again.');
    } finally {
      console.log(' Setting loading to false');
      setIsLoading(false);
    }
  };
  
  const togglePasswordVisibility = () => {
    setIsPasswordVisible(!isPasswordVisible);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: FLAVORWORLD_COLORS.background }}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <View style={styles.logoBackground}>
              <Text style={styles.logoText}>🍳</Text>
            </View>
          </View>

          <Text style={styles.title}>
            Welcome to <Text style={{ color: FLAVORWORLD_COLORS.secondary }}>FlavorWorld</Text>
          </Text>

          <Text style={styles.subtitle}>
            Join the delicious recipe community
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.input}>
            <Text style={styles.inputLabel}>Email address</Text>

            <View>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                clearButtonMode="while-editing"
                keyboardType="email-address"
                onChangeText={handleEmailChange}
                placeholder="example@FlavorWorld.com"
                placeholderTextColor={FLAVORWORLD_COLORS.textLight}
                style={[
                  styles.inputControl,
                  emailError ? styles.inputError : null
                ]}
                value={form.email}
              />
              {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
            </View>
          </View>

          <View style={styles.input}>
            <Text style={styles.inputLabel}>Password</Text>

            <View>
              <View style={styles.passwordContainer}>
                <TextInput
                  autoCorrect={false}
                  clearButtonMode="while-editing"
                  onChangeText={handlePasswordChange}
                  placeholder="Enter your password"
                  placeholderTextColor={FLAVORWORLD_COLORS.textLight}
                  style={[
                    styles.inputControl,
                    styles.passwordInput,
                    passwordError ? styles.inputError : null
                  ]}
                  secureTextEntry={!isPasswordVisible}
                  value={form.password}
                />
                <TouchableOpacity 
                  style={styles.visibilityIcon} 
                  onPress={togglePasswordVisibility}
                >
                  <Text style={styles.eyeIcon}>
                    {isPasswordVisible ? '👁️' : '👁️‍🗨️'}
                  </Text>
                </TouchableOpacity>
              </View>
              {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
            </View>
          </View>

          <View style={styles.formAction}>
            {/**/}
            <TouchableOpacity 
              onPress={handleLogin}
              disabled={isLoading}
              style={[
                styles.btn,
                isLoading && styles.btnDisabled
              ]}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={FLAVORWORLD_COLORS.white} />
              ) : (
                <Text style={styles.btnText}>Sign in</Text>
              )}
            </TouchableOpacity>
          </View>



          <TouchableOpacity
            onPress={() => {
              navigation.navigate('ForgotPassword');
            }}>
            <Text style={styles.formLink}>Forgot password?</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity
        onPress={() => {
          navigation.navigate('Register');
        }}>
        <Text style={styles.formFooter}>
          Don't have an account?{' '}
          <Text style={{ textDecorationLine: 'underline', color: FLAVORWORLD_COLORS.secondary }}>Join FlavorWorld</Text>
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

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
    borderColor: FLAVORWORLD_COLORS.primary,
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
    marginTop: 4,
    marginBottom: 16,
  },
  formLink: {
    fontSize: 16,
    fontWeight: '600',
    color: FLAVORWORLD_COLORS.secondary,
    textAlign: 'center',
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
    borderStyle: 'solid',
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
  passwordContainer: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
  },
  visibilityIcon: {
    position: 'absolute',
    right: 16,
    backgroundColor: FLAVORWORLD_COLORS.background,
    borderRadius: 15,
    padding: 8,
  },
  eyeIcon: {
    fontSize: 16,
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
});