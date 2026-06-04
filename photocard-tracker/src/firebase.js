// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "jujuscollcatalog.firebaseapp.com",
  projectId: "jujuscollcatalog",
  storageBucket: "jujuscollcatalog.firebasestorage.app",
  messagingSenderId: "144682863645",
  appId: "1:144682863645:web:0f98d01c0aaa02ec054af4",
  measurementId: "G-6YJHS7MMQQ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Exports for usage
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});
export const auth = getAuth(app);