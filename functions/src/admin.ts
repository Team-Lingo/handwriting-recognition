import * as admin from "firebase-admin";

// Initialize Admin SDK once per process (safe across cold starts)
if (!admin.apps.length) {
    admin.initializeApp();
}

// Re-export admin and common handles for convenience
const db = admin.firestore();

export { admin, db };
