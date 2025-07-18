import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import LoginScreen from '../components/screens/auth/LoginScreen';
import RegisterScreen from '../components/screens/auth/RegisterScreen';
import ForgotPasswordScreen from '../components/screens/auth/ForgotPasswordScreen';


const Stack = createStackNavigator();

const AuthNavigator = () => {
  return (
    <Stack.Navigator 
      initialRouteName="Login"
      screenOptions={{
        headerShown: false, // הסתרת כותרות עבור מסכי אימות
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
    </Stack.Navigator>
  );
};

export default AuthNavigator;