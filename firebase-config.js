// ========================================
// FIREBASE CONFIGURATION
// ========================================

const firebaseConfig = {
    apiKey: "AIzaSyD4AuL_qDJOuQm7YH2vYuTMyBcxyKUIYtE",
    authDomain: "ricko-s-app.firebaseapp.com",
    projectId: "ricko-s-app",
    storageBucket: "ricko-s-app.firebasestorage.app",
    messagingSenderId: "7280042713",
    appId: "1:7280042713:web:cd5d400667b068265014c8"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firestore
const db = firebase.firestore();

console.log('🔥 Firebase + Firestore initialized');
