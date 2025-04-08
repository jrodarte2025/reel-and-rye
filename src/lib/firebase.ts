// src/lib/firebase.ts
import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyCVJk0_nSyoq2ayzrfJlDzDJxGG-Mw2mq0",
  authDomain: "movie-night-2c01c.firebaseapp.com",
  projectId: "movie-night-2c01c",
  storageBucket: "movie-night-2c01c.firebasestorage.app",
  messagingSenderId: "741730849022",
  appId: "1:741730849022:web:b1f6a0ff31562b9f4e55af"
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

export { db }