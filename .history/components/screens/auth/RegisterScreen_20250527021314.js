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

  // פונקציה מעודכנת עם קריאה למונגו
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
          'Success', 
          'Registration completed successfully!', 
          [{ text: 'OK', onPress: () => navigation.navigate('Home') }]
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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#d3d3d3' }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Image
              alt="App Logo"
              resizeMode="contain"
              style={styles.headerImg}
              source={{ uri: 'https://haraayonot.com/wp-content/uploads/2016/08/Logo.png' }}
            />
            <Text style={styles.title}>Create an Account</Text>
            <Text style={styles.subtitle}>Sign up to get started with MyApp</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.input}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <TextInput
                autoCorrect={false}
                onChangeText={(text) => handleInputChange('fullName', text)}
                placeholder="John Doe"
                placeholderTextColor="#6b7280"
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
                placeholder="example@example.com"
              />
              {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
            </View>

            <View style={styles.input}>
              <Text style={styles.inputLabel}>Password</Text>
              <PasswordInput
                value={form.password}
                onChangeText={handlePasswordChange}
                placeholder="Create a password"
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
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.btnText}>Create Account</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={styles.formFooter}>
            Already have an account? <Text style={{ textDecorationLine: 'underline' }}>Sign in</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24 },
  title: { fontSize: 31, fontWeight: '700', color: '#1D2A32', marginBottom: 6 },
  subtitle: { fontSize: 15, fontWeight: '500', color: '#929292', textAlign: 'center', paddingHorizontal: 20 },
  header: { alignItems: 'center', justifyContent: 'center', marginVertical: 24 },
  headerImg: { width: 80, height: 80, alignSelf: 'center', marginBottom: 24 },
  form: { flexGrow: 1 },
  input: { marginBottom: 16 },
  inputLabel: { fontSize: 17, fontWeight: '600', color: '#222', marginBottom: 8 },
  inputControl: {
    height: 50, backgroundColor: '#fff', paddingHorizontal: 16,
    borderRadius: 12, fontSize: 15, fontWeight: '500',
    color: '#222', borderWidth: 1, borderColor: '#C9D3DB',
  },
  inputError: { borderColor: '#e74c3c' },
  errorText: { color: '#e74c3c', fontSize: 14, marginTop: 5 },
  formAction: { marginTop: 20, marginBottom: 16 },
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: 30, paddingVertical: 10, paddingHorizontal: 20,
    borderWidth: 1, backgroundColor: '#075eec', borderColor: '#075eec',
  },
  btnDisabled: {
    backgroundColor: '#a9c0e9',
    borderColor: '#a9c0e9',
  },
  btnText: { fontSize: 18, lineHeight: 26, fontWeight: '600', color: '#fff' },
  formFooter: {
    paddingVertical: 24, fontSize: 15, fontWeight: '600',
    color: '#222', textAlign: 'center', letterSpacing: 0.15,
  },
});

export default RegisterScreen;