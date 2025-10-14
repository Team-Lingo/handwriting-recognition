import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAnalytics, Analytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyAUZbFGyE78QBcclqLAwuGvSH4di7pOeDc",
    authDomain: "lingo-handwriting-recognition.firebaseapp.com",
    projectId: "lingo-handwriting-recognition",
    storageBucket: "lingo-handwriting-recognition.firebasestorage.app",
    messagingSenderId: "241201967207",
    appId: "1:241201967207:web:735a3c1902c70c816ee4c2",
    measurementId: "G-TY3EGQV34Q",
};

let app: FirebaseApp;
let analytics: Analytics | null = null;

if (!getApps().length) {
    app = initializeApp(firebaseConfig);
} else {
    app = getApps()[0];
}

const auth = getAuth(app);
const db = getFirestore(app);

if (typeof window !== "undefined") {
    analytics = getAnalytics(app);
}

export { app, analytics, auth, db };
