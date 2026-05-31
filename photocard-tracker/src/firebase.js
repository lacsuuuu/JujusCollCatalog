// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "photocard-db.firebaseapp.com",
  projectId: "photocard-db",
  storageBucket: "photocard-db.firebasestorage.app",
  messagingSenderId: "144682863645",
  appId: "1:144682863645:web:0f98d01c0aaa02ec054af4",
  measurementId: "G-6YJHS7MMQQ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Exports for usage
export const db = getFirestore(app);
export const auth = getAuth(app);