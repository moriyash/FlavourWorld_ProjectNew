import React, { createContext, useState, useContext, useEffect } from 'react'; 
import AsyncStorage from '@react-native-async-storage/async-storage'; 

const AuthContext = createContext(); 

export const AuthProvider = ({ children }) => { 
  const [isLoggedIn, setIsLoggedIn] = useState(false); 
  const [isLoading, setIsLoading] = useState(true); 
  const [userToken, setUserToken] = useState(null); 
  
  useEffect(() => { 
    // בדיקת סטטוס התחברות בעת טעינת האפליקציה 
    const checkLoginStatus = async () => { 
      try { 
        const token = await AsyncStorage.getItem('userToken'); 
        if (token) { 
          setUserToken(token); 
          setIsLoggedIn(true); 
        } else {
          // תיקון - וודא שמצב אימות מוגדר ל-false אם אין טוקן
          setUserToken(null);
          setIsLoggedIn(false);
        }
      } catch (error) { 
        console.error("Error checking login status:", error); 
        // תיקון - וודא שמצב אימות מוגדר ל-false במקרה של שגיאה
        setUserToken(null);
        setIsLoggedIn(false);
      } finally { 
        setIsLoading(false); 
      } 
    }; 
    
    checkLoginStatus(); 
  }, []); 
  
  const login = async (token) => { 
    try { 
      await AsyncStorage.setItem('userToken', token); 
      setUserToken(token); 
      setIsLoggedIn(true); 
    } catch (error) { 
      console.error("Error during login:", error); 
      throw error; 
    } 
  }; 
  
  const logout = async () => { 
    try { 
      await AsyncStorage.removeItem('userToken'); 
      setUserToken(null); 
      setIsLoggedIn(false); 
    } catch (error) { 
      console.error("Error during logout:", error); 
      throw error; 
    } 
  }; 
  
  return ( 
    <AuthContext.Provider 
      value={{ 
        isLoggedIn, 
        isLoading, 
        userToken, 
        login, 
        logout 
      }} 
    > 
      {children} 
    </AuthContext.Provider> 
  ); 
}; 

export const useAuth = () => useContext(AuthContext);