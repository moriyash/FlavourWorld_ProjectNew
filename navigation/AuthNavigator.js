import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import LoginScreen from '../components/screens/auth/LoginScreen';
import RegisterScreen from '../components/screens/auth/RegisterScreen';
import ForgotPasswordScreen from '../components/screens/auth/ForgotPasswordScreen';
import NewPasswordScreen from '../components/screens/auth/NewPasswordScreen';
import PasswordResetCodeScreen from '../components/screens/auth/PasswordResetCodeScreen';



const Stack = createStackNavigator();

const AuthNavigator = () => {
  return (
    <Stack.Navigator 
      initialRouteName="Login"
      screenOptions={{
        headerShown: false, 
      }}
    >
      <Stack.Screen 
        name="Login" 
        component={LoginScreen} 
      />
      <Stack.Screen 
        name="Register" 
        component={RegisterScreen} 
      />
      <Stack.Screen 
        name="ForgotPassword" 
        component={ForgotPasswordScreen} 
      />
      <Stack.Screen 
        name="PasswordResetCode" 
        component={PasswordResetCodeScreen} 
      />
      <Stack.Screen 
        name="NewPassword" 
        component={NewPasswordScreen} 
      />
    </Stack.Navigator>
  );
};

export default AuthNavigator;