import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userToken, setUserToken] = useState(null);
  const [currentUser, setCurrentUser] = useState(null); // הוספת משתמש נוכחי

  useEffect(() => {
    // בדיקת סטטוס התחברות בעת טעינת האפליקציה
    const checkLoginStatus = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        const userData = await AsyncStorage.getItem('userData');
        
        if (token && userData) {
          setUserToken(token);
          setCurrentUser(JSON.parse(userData));
          setIsLoggedIn(true);
        } else {
          // תיקון - וודא שמצב אימות מוגדר ל-false אם אין טוקן
          setUserToken(null);
          setCurrentUser(null);
          setIsLoggedIn(false);
        }
      } catch (error) {
        console.error("Error checking login status:", error);
        // תיקון - וודא שמצב אימות מוגדר ל-false במקרה של שגיאה
        setUserToken(null);
        setCurrentUser(null);
        setIsLoggedIn(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkLoginStatus();
  }, []);

  const login = async (token, userData = null) => {
  try {
    if (!token) {
      throw new Error("Token is missing during login");
    }

    await AsyncStorage.setItem('userToken', token);

    if (userData) {
      await AsyncStorage.setItem('userData', JSON.stringify(userData));
      setCurrentUser(userData);
    }

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
      await AsyncStorage.removeItem('userData');
      setUserToken(null);
      setCurrentUser(null);
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
        currentUser, // הוספת משתמש נוכחי לקונטקסט
        login,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);