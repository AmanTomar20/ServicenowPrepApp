import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAHkRXHnntJm1RY4OZ86u5zjFbESVd2MUk",
  authDomain: "quizpracticeapp.firebaseapp.com",
  projectId: "quizpracticeapp",
  storageBucket: "quizpracticeapp.firebasestorage.app",
  messagingSenderId: "186568548797",
  appId: "1:186568548797:web:1a53a8cd68805fda1332d4",
  measurementId: "G-1REK2CKVQZ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);