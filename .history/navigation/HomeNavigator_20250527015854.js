import React from 'react'; 
import { createStackNavigator } from '@react-navigation/stack'; 
import HomeScreen from '../components/screens/Home/HomeScreen';

const Stack = createStackNavigator(); 

export default function HomeNavigator() { 
  return ( 
    <Stack.Navigator> 
      <Stack.Screen 
        name="Home" 
        component={HomeScreen} 
        options={{ headerShown: false }} 
      /> 
    </Stack.Navigator>
  );
}
