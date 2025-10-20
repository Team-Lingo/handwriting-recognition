"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
    User,
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut as firebaseSignOut,
    sendPasswordResetEmail,
    GoogleAuthProvider,
    signInWithPopup,
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth } from "@/lib/firebase";
import { db } from "@/lib/firebase";

interface UserProfile {
    firstName: string;
    lastName: string;
    email: string;
    createdAt: string;
}

interface AuthContextType {
    user: User | null;
    userProfile: UserProfile | null;
    loading: boolean;
    signUp: (email: string, password: string, firstName: string, lastName: string) => Promise<void>;
    signIn: (email: string, password: string) => Promise<void>;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
    resetPassword: (email: string) => Promise<void>;
    refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setUser(user);

            if (user) {
                // Fetch user profile from Firestore
                try {
                    const userDoc = await getDoc(doc(db, "users", user.uid));
                    if (userDoc.exists()) {
                        setUserProfile(userDoc.data() as UserProfile);
                    }
                } catch (error) {
                    console.error("Error fetching user profile:", error);
                }
            } else {
                setUserProfile(null);
            }

            setLoading(false);
        });

        return unsubscribe;
    }, []);

    const signUp = async (email: string, password: string, firstName: string, lastName: string) => {
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Wait for auth token to be ready
            await user.getIdToken();

            // Create user profile in Firestore
            const userProfile: UserProfile = {
                firstName,
                lastName,
                email,
                createdAt: new Date().toISOString(),
            };

            await setDoc(doc(db, "users", user.uid), userProfile);
        } catch (error) {
            console.error("Error during sign up:", error);
            throw error;
        }
    };

    const signIn = async (email: string, password: string) => {
        await signInWithEmailAndPassword(auth, email, password);
    };

    const signOut = async () => {
        await firebaseSignOut(auth);
    };

    const resetPassword = async (email: string) => {
        const trimmed = email.trim();
        // Prefer a known app URL if provided; otherwise use window origin in browser
        const origin =
            (typeof window !== "undefined" && window.location.origin) ||
            process.env.NEXT_PUBLIC_APP_URL;

        const actionCodeSettings = origin
            ? {
                  url: `${origin}/login`,
                  handleCodeInApp: false,
              }
            : undefined;

        await sendPasswordResetEmail(auth, trimmed, actionCodeSettings);
    };

    const refreshUserProfile = async () => {
        if (user) { // means that the user is logged in
            try {
                const userDoc = await getDoc(doc(db, "users", user.uid));
                if (userDoc.exists()) {
                    setUserProfile(userDoc.data() as UserProfile);
                }
            } catch (error) {
                console.error("Error refreshing user profile:", error);
            }
        }
    };

    const signInWithGoogle = async () => {
        try {
            const provider = new GoogleAuthProvider();
            const result = await signInWithPopup(auth, provider);
            const user = result.user;

            // Check if user profile exists, if not create one
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (!userDoc.exists()) {
                const userProfile: UserProfile = {
                    firstName: user.displayName?.split(' ')[0] || '',
                    lastName: user.displayName?.split(' ').slice(1).join(' ') || '',
                    email: user.email || '',
                    createdAt: new Date().toISOString(),
                };
                await setDoc(doc(db, "users", user.uid), userProfile);
            }
        } catch (error) {
            console.error("Error during Google sign in:", error);
            throw error;
        }
    };

    

    const value = {
        user,
        userProfile,
        loading,
        signUp,
        signIn,
        signInWithGoogle,
        signOut,
        resetPassword,
        refreshUserProfile,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
