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
    GithubAuthProvider,
    signInWithPopup,
    fetchSignInMethodsForEmail,
    linkWithCredential,
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth } from "@/lib/firebase";
import { db } from "@/lib/firebase";
import type { FirebaseError } from "firebase/app";

interface UserProfile {
    firstName: string;
    lastName: string;
    email: string;
    createdAt: string;
    role?: "Admin" | "User" | string;
    profilePictureUrl?: string;
    profilePicturePath?: string;
}

interface AuthContextType {
    user: User | null;
    userProfile: UserProfile | null;
    loading: boolean;
    signUp: (email: string, password: string, firstName: string, lastName: string) => Promise<void>;
    signIn: (email: string, password: string) => Promise<void>;
    signInWithGoogle: () => Promise<void>;
    signInWithGithub: () => Promise<void>;
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
                    const userRef = doc(db, "users", user.uid);
                    const userDoc = await getDoc(userRef);
                    if (userDoc.exists()) {
                        setUserProfile(userDoc.data() as UserProfile);
                    } else {
                        // Create a basic profile for any newly signed-in user (e.g., GitHub first-time)
                        const displayName = user.displayName || "";
                        const firstName = displayName.split(" ")[0] || "";
                        const lastName = displayName.split(" ").slice(1).join(" ") || "";
                        const profile: UserProfile = {
                            firstName,
                            lastName,
                            email: user.email || "",
                            createdAt: new Date().toISOString(),
                        };
                        await setDoc(userRef, profile);
                        setUserProfile(profile);
                    }
                } catch (error: unknown) {
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
        } catch (error: unknown) {
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
        const origin = (typeof window !== "undefined" && window.location.origin) || process.env.NEXT_PUBLIC_APP_URL;

        const actionCodeSettings = origin
            ? {
                  url: `${origin}/login`,
                  handleCodeInApp: false,
              }
            : undefined;

        await sendPasswordResetEmail(auth, trimmed, actionCodeSettings);
    };

    const refreshUserProfile = async () => {
        if (user) {
            // means that the user is logged in
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
                    firstName: user.displayName?.split(" ")[0] || "",
                    lastName: user.displayName?.split(" ").slice(1).join(" ") || "",
                    email: user.email || "",
                    createdAt: new Date().toISOString(),
                };
                await setDoc(doc(db, "users", user.uid), userProfile);
            }
        } catch (error: unknown) {
            // Handle account linking if the email already exists with a different provider
            // https://firebase.google.com/docs/auth/web/google-signin#handle_the_sign-in_flow_with_the_firebase_sdk
            // @ts-expect-error Firebase error typing with customData
            const code = error?.code as string | undefined;
            if (code === "auth/account-exists-with-different-credential") {
                // @ts-expect-error Firebase error typing with customData
                const email = error?.customData?.email as string | undefined;
                const pendingCred = GoogleAuthProvider.credentialFromError(error as FirebaseError);
                if (email && pendingCred) {
                    const methods = await fetchSignInMethodsForEmail(auth, email);
                    if (methods.includes("github.com")) {
                        // Sign in with the provider that already owns this email, then link
                        const ghProvider = new GithubAuthProvider();
                        ghProvider.addScope("user:email");
                        const ghResult = await signInWithPopup(auth, ghProvider);
                        await linkWithCredential(ghResult.user, pendingCred);
                        return; // linked and signed in
                    } else if (methods.includes("password")) {
                        throw new Error(
                            "An account already exists with this email using a password. Please sign in with email/password first, then link Google from your profile."
                        );
                    } else if (methods.length) {
                        throw new Error(
                            `An account already exists with this email using ${methods[0]}. Sign in with that provider first, then link Google from your profile.`
                        );
                    }
                }
            }
            console.error("Error during Google sign in:", error);
            throw error;
        }
    };

    const signInWithGithub = async () => {
        try {
            const provider = new GithubAuthProvider();
            // Request access to user's email addresses to populate profile email
            provider.addScope("user:email");
            const result = await signInWithPopup(auth, provider);
            const user = result.user;

            // Attempt to retrieve email via GitHub API if not provided by Firebase
            let email = user.email || "";
            if (!email) {
                try {
                    const cred = GithubAuthProvider.credentialFromResult(result);
                    const accessToken = cred?.accessToken;
                    if (accessToken) {
                        const resp = await fetch("https://api.github.com/user/emails", {
                            headers: { Authorization: `token ${accessToken}` },
                        });
                        if (resp.ok) {
                            const emails: Array<{ email: string; primary: boolean; verified: boolean }> =
                                await resp.json();
                            const primary =
                                emails.find((e) => e.primary && e.verified) ||
                                emails.find((e) => e.primary) ||
                                emails[0];
                            if (primary?.email) {
                                email = primary.email;
                            }
                        }
                    }
                } catch {
                    // ignore and continue
                }
            }

            // Check if user profile exists, if not create one
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (!userDoc.exists()) {
                const displayName = user.displayName || "";
                const firstName = displayName.split(" ")[0] || "";
                const lastName = displayName.split(" ").slice(1).join(" ") || "";
                const userProfile: UserProfile = {
                    firstName,
                    lastName,
                    email,
                    createdAt: new Date().toISOString(),
                };
                await setDoc(doc(db, "users", user.uid), userProfile);
            }
        } catch (error: unknown) {
            // Handle account linking when email exists with a different provider
            // @ts-expect-error Firebase error typing with customData
            const code = error?.code as string | undefined;
            if (code === "auth/account-exists-with-different-credential") {
                // @ts-expect-error Firebase error typing with customData
                const email = error?.customData?.email as string | undefined;
                const pendingCred = GithubAuthProvider.credentialFromError(error as FirebaseError);
                if (email && pendingCred) {
                    const methods = await fetchSignInMethodsForEmail(auth, email);
                    if (methods.includes("google.com")) {
                        const googleProvider = new GoogleAuthProvider();
                        const googleResult = await signInWithPopup(auth, googleProvider);
                        await linkWithCredential(googleResult.user, pendingCred);
                        return; // linked and signed in
                    } else if (methods.includes("password")) {
                        throw new Error(
                            "An account already exists with this email using a password. Please sign in with email/password first, then link GitHub from your profile."
                        );
                    } else if (methods.length) {
                        throw new Error(
                            `An account already exists with this email using ${methods[0]}. Sign in with that provider first, then link GitHub from your profile.`
                        );
                    }
                }
            }
            console.error("Error during GitHub sign in:", error);
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
        signInWithGithub,
        signOut,
        resetPassword,
        refreshUserProfile,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
