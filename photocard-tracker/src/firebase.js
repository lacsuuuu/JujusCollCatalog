// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getAuth } from "firebase/auth";

const useTestDb = import.meta.env.VITE_USE_TEST_DB === 'true';

const firebaseConfig = {
  apiKey: useTestDb ? import.meta.env.VITE_TEST_FIREBASE_API_KEY : import.meta.env.VITE_FIREBASE_API_KEY,
  
  authDomain: useTestDb ? "photocard-db.firebaseapp.com" : "jujuscollcatalog.firebaseapp.com",
  projectId: useTestDb ? "photocard-db" : "jujuscollcatalog",
  storageBucket: useTestDb ? "photocard-db.firebasestorage.app" : "jujuscollcatalog.firebasestorage.app",
  messagingSenderId: useTestDb ? "144682863645" : "144682863645",
  appId: useTestDb ? "1:144682863645:web:0f98d01c0aaa02ec054af4" : "1:144682863645:web:0f98d01c0aaa02ec054af4",
  measurementId: useTestDb ? "G-6YJHS7MMQQ" : "G-6YJHS7MMQQ"
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