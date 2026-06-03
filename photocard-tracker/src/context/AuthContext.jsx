import { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../firebase'; // Adjust this path if your firebase.js is somewhere else
import { onAuthStateChanged } from 'firebase/auth';

// Create the context
const AuthContext = createContext();

// Create a custom hook so other files can easily use this context
export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

 useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    console.log("AuthProvider: Auth state changed. Loading finished.");
    console.log("Auth State Changed. User is:", user);
    setCurrentUser(user);
    setLoading(false);
  });
  return unsubscribe;
}, []);

  const value = {
    currentUser
  };

  return (
    <AuthContext.Provider value={value}>
      {/* Only render the app's components once we finish checking auth status */}
      {!loading && children}
    </AuthContext.Provider>
  );
}