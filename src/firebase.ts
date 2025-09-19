// Firebase初期化用
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// TODO: 下記はご自身のFirebaseプロジェクトの設定値に置き換えてください
const firebaseConfig = {
 apiKey: "AIzaSyBL3wZ_pbT4Wj_Jm4yPRgQIm5pKiqbGL3M",
  authDomain: "storage-6b3e2.firebaseapp.com",
  projectId: "storage-6b3e2",
  storageBucket: "storage-6b3e2.firebasestorage.app",
  messagingSenderId: "831791954498",
  appId: "1:831791954498:web:0741d01924e961a809cbdb",
  measurementId: "G-WG3M2EEREG"
};


export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
