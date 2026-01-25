"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import styles from "./authPage.module.css";
import LoadingButton from "@/components/loading/loading/LoadingButton";
import Loader from "@/components/loading/loading/Loader";

import { auth } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";

import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    fetchSignInMethodsForEmail,
    sendPasswordResetEmail,
    onAuthStateChanged,
    User,
    setPersistence,
    browserLocalPersistence,
    inMemoryPersistence,
    signOut,
    updateCurrentUser,
} from "firebase/auth";

import { getFriendlyAuthError } from "@/lib/firebase/authErrors";
import { callUpdateProfile } from "@/lib/firebase/functions";

import triggerNotification from "@/lib/firebase/triggerNotification";

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false" {...props}>
            <path
                fill="#FFC107"
                d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path>
            <path
                fill="#FF3D00"
                d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path>
            <path
                fill="#4CAF50"
                d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path>
            <path
                fill="#1976D2"
                d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path>
        </svg>
    );
}

function GithubIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
            <path
                fill="black"
                d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.11.82-.26.82-.58 0-.29-.01-1.05-.015-2.06-3.338.725-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.757-1.333-1.757-1.09-.745.082-.73.082-.73 1.205.085 1.84 1.237 1.84 1.237 1.072 1.835 2.81 1.305 3.495.997.11-.777.42-1.305.763-1.605-2.665-.305-5.466-1.332-5.466-5.93 0-1.31.47-2.38 1.235-3.22-.125-.303-.535-1.523.115-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.4 3-.405 1.02.005 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.655 1.653.245 2.873.12 3.176.77.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.62-5.475 5.92.43.37.81 1.096.81 2.215 0 1.6-.015 2.89-.015 3.285 0 .32.21.695.825.575C20.565 21.795 24 17.295 24 12 24 5.37 18.63 0 12 0z"></path>
        </svg>
    );
}

export default function AuthPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { signInWithGoogle, signInWithGithub } = useAuth();

    const rawNext = searchParams.get("next") || "/dashboard";
    const nextUrl = rawNext.startsWith("/api") || !rawNext.startsWith("/") ? "/dashboard" : rawNext;

    const [isSignIn, setIsSignIn] = useState(true);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [errorSignup, setErrorSignup] = useState("");
    const [errorSignin, setErrorSignin] = useState("");
    const [errorSocial, setErrorSocial] = useState("");
    const [isMobile, setIsMobile] = useState(false);

    const [isSigningIn, setIsSigningIn] = useState(false);
    const [isSigningUp, setIsSigningUp] = useState(false);
    const [isSigningInGoogle, setIsSigningInGoogle] = useState(false);
    const [isSigningInGithub, setIsSigningInGithub] = useState(false);
    const [isSendingReset, setIsSendingReset] = useState(false);
    const [redirecting, setRedirecting] = useState(false);

    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.matchMedia("(max-width: 768px)").matches);
        };
        checkMobile();
        window.addEventListener("resize", checkMobile);
        return () => window.removeEventListener("resize", checkMobile);
    }, []);

    useEffect(() => {
        if (searchParams.has("signup")) setIsSignIn(false);
    }, [searchParams]);

    const isValidEmail = async (e: string) => {
        try {
            await fetchSignInMethodsForEmail(auth, e);
            return true;
        } catch (err: unknown) {
            if (
                typeof err === "object" &&
                err !== null &&
                "code" in err &&
                typeof (err as { code?: unknown }).code === "string" &&
                (err as { code: string }).code === "auth/invalid-email"
            ) {
                return false;
            }
            return true;
        }
    };

    const resolveAuthErrorMessage = (err: unknown) => {
        const code =
            typeof err === "object" && err !== null && "code" in err ? (err as { code?: unknown }).code : undefined;
        if (typeof code === "string") return getFriendlyAuthError(code);
        if (err instanceof Error && err.message) return err.message;
        return "Something went wrong. Please try again.";
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            setCurrentUser(firebaseUser);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    if (loading || redirecting) return <Loader />;

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSigningUp(true);
        setErrorSignup("");
        setErrorSocial("");

        try {
            if (currentUser) await signOut(auth);

            await setPersistence(auth, inMemoryPersistence);

            if (!email || !password || !firstName || !lastName) {
                setErrorSignup("Please fill in all required fields.");
                return;
            }
            if (!(await isValidEmail(email))) {
                setErrorSignup("Please enter a valid email");
                return;
            }
            const methods = await fetchSignInMethodsForEmail(auth, email);
            if (methods.length > 0) {
                setErrorSignup("Email already in use");
                return;
            }
            if (confirmPassword !== password) {
                setErrorSignup("Please enter the same password");
                return;
            }

            await createUserWithEmailAndPassword(auth, email, password);
            await callUpdateProfile({
                firstName,
                lastName,
                timezone: "America/New_York",
                timeFormat: "12",
            });

            await triggerNotification({
                type: "signup",
                notification: "You just created a new account",
            });

            setRedirecting(true);
            await setPersistence(auth, browserLocalPersistence);
            if (auth.currentUser) await updateCurrentUser(auth, auth.currentUser);
            router.push(nextUrl);

            setEmail("");
            setPassword("");
            setFirstName("");
            setLastName("");
        } catch (err: unknown) {
            setErrorSignup(resolveAuthErrorMessage(err));
        } finally {
            setIsSigningUp(false);
        }
    };

    const handleSignin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSigningIn(true);
        setErrorSignin("");
        setErrorSocial("");

        try {
            if (currentUser) await signOut(auth);

            await setPersistence(auth, inMemoryPersistence);

            if (!email || !password) {
                setErrorSignin("Please enter both email and password.");
                return;
            }
            if (!(await isValidEmail(email))) {
                setErrorSignin("Please enter a valid email");
                return;
            }

            await signInWithEmailAndPassword(auth, email, password);

            setRedirecting(true);
            await setPersistence(auth, browserLocalPersistence);
            if (auth.currentUser) await updateCurrentUser(auth, auth.currentUser);
            router.push(nextUrl);

            setEmail("");
            setPassword("");
        } catch (err: unknown) {
            setErrorSignin(resolveAuthErrorMessage(err));
        } finally {
            setIsSigningIn(false);
        }
    };

    const handleSocialSignin = async (provider: "google" | "github") => {
        setErrorSignin("");
        setErrorSignup("");
        setErrorSocial("");

        if (provider === "google") setIsSigningInGoogle(true);
        else setIsSigningInGithub(true);

        try {
            if (currentUser) await signOut(auth);
            await setPersistence(auth, inMemoryPersistence);

            if (provider === "google") {
                await signInWithGoogle();
            } else {
                await signInWithGithub();
            }

            setRedirecting(true);
            await setPersistence(auth, browserLocalPersistence);
            if (auth.currentUser) await updateCurrentUser(auth, auth.currentUser);
            router.push(nextUrl);
        } catch (err: unknown) {
            setErrorSocial(resolveAuthErrorMessage(err));
        } finally {
            setIsSigningInGoogle(false);
            setIsSigningInGithub(false);
        }
    };

    const handleForgotPassword = async () => {
        if (!email) {
            setErrorSignin("Enter your e-mail above first");
            return;
        }

        setIsSendingReset(true);

        try {
            await sendPasswordResetEmail(auth, email, {
                url: `${window.location.origin}/auth?reset=true`,
                handleCodeInApp: false,
            });

            await triggerNotification({
                type: "profile",
                notification: "Updated your profile successfully",
            });

            // Password reset link sent successfully
            console.log("A password-reset link was sent to your e-mail");
            setErrorSignin("");
        } catch (err: unknown) {
            const code =
                typeof err === "object" && err !== null && "code" in err ? (err as { code: string }).code : "unknown";
            setErrorSignin(getFriendlyAuthError(code));
        } finally {
            setIsSendingReset(false);
        }
    };

    return (
        <div className={`${styles.container} ${!isSignIn ? styles.active : ""}`}>
            {isMobile ? (
                isSignIn ? (
                    <>
                        <div className={`${styles.formContainer} ${styles.signInForm}`}>
                            <form onSubmit={handleSignin} className={styles.form}>
                                <h2 className={styles.title}>Sign In</h2>
                                <div className={styles.socialButtons}>
                                    <LoadingButton
                                        type="button"
                                        onClick={() => handleSocialSignin("google")}
                                        loading={isSigningInGoogle}
                                        disabled={isSigningIn || isSendingReset || isSigningInGithub}
                                        variant="secondary"
                                        fullWidth
                                        className={`${styles.socialButton} ${styles.formButton}`}>
                                        <span className={styles.buttonContent}>
                                            <GoogleIcon className={styles.googleIcon} />
                                            <span>Continue with Google</span>
                                        </span>
                                    </LoadingButton>
                                    <LoadingButton
                                        type="button"
                                        onClick={() => handleSocialSignin("github")}
                                        loading={isSigningInGithub}
                                        disabled={isSigningIn || isSendingReset || isSigningInGoogle}
                                        variant="secondary"
                                        fullWidth
                                        className={`${styles.socialButton} ${styles.formButton}`}>
                                        <span className={styles.buttonContent}>
                                            <GithubIcon className={styles.githubIcon} />
                                            <span>Continue with GitHub</span>
                                        </span>
                                    </LoadingButton>
                                </div>
                                <div className={styles.divider}>
                                    <span>or</span>
                                </div>
                                <div className={styles.inputGroup}>
                                    <label className={styles.label}>Email</label>
                                    <input
                                        type="email"
                                        className={styles.input}
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        disabled={isSigningIn}
                                    />
                                </div>
                                <div className={styles.inputGroup}>
                                    <label className={styles.label}>Password</label>
                                    <input
                                        type="password"
                                        className={styles.input}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        disabled={isSigningIn}
                                    />
                                </div>
                                <LoadingButton
                                    type="submit"
                                    onClick={() => {}}
                                    loading={isSigningIn}
                                    variant="primary"
                                    fullWidth
                                    className={`${styles.button} ${styles.formButton}`}>
                                    {isSigningIn ? "Signing In..." : "Sign In"}
                                </LoadingButton>
                                <LoadingButton
                                    type="button"
                                    onClick={handleForgotPassword}
                                    loading={isSendingReset}
                                    variant="secondary"
                                    fullWidth
                                    className={`${styles.forgotPassword} ${styles.formButton}`}>
                                    {isSendingReset ? "Sending..." : "Forgot password?"}
                                </LoadingButton>
                                <p className={styles.errorMessage}>{errorSignin}</p>
                                <p className={styles.errorMessage}>{errorSocial}</p>
                            </form>
                        </div>
                        <div className={styles.mobileToggleWrapper}>
                            <h2 className={styles.mobileToggleTitle}>Need to create an account?</h2>
                            <button
                                className={styles.mobileToggleButton}
                                onClick={() => setIsSignIn(false)}
                                disabled={isSigningIn || isSendingReset}>
                                Sign Up
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <div className={`${styles.formContainer} ${styles.signUpForm}`}>
                            <form onSubmit={handleSignup} className={styles.form}>
                                <h2 className={styles.title}>Sign Up</h2>
                                <div className={styles.socialButtons}>
                                    <LoadingButton
                                        type="button"
                                        onClick={() => handleSocialSignin("google")}
                                        loading={isSigningInGoogle}
                                        disabled={isSigningUp || isSigningInGithub}
                                        variant="secondary"
                                        fullWidth
                                        className={`${styles.socialButton} ${styles.formButton}`}>
                                        <span className={styles.buttonContent}>
                                            <GoogleIcon className={styles.googleIcon} />
                                            <span>Continue with Google</span>
                                        </span>
                                    </LoadingButton>
                                    <LoadingButton
                                        type="button"
                                        onClick={() => handleSocialSignin("github")}
                                        loading={isSigningInGithub}
                                        disabled={isSigningUp || isSigningInGoogle}
                                        variant="secondary"
                                        fullWidth
                                        className={`${styles.socialButton} ${styles.formButton}`}>
                                        <span className={styles.buttonContent}>
                                            <GithubIcon className={styles.githubIcon} />
                                            <span>Continue with GitHub</span>
                                        </span>
                                    </LoadingButton>
                                </div>
                                <div className={styles.divider}>
                                    <span>or</span>
                                </div>
                                <div className={styles.inputGroup}>
                                    <label className={styles.label}>First Name</label>
                                    <input
                                        type="text"
                                        className={styles.input}
                                        value={firstName}
                                        onChange={(e) => setFirstName(e.target.value)}
                                        required
                                        disabled={isSigningUp}
                                    />
                                </div>
                                <div className={styles.inputGroup}>
                                    <label className={styles.label}>Last Name</label>
                                    <input
                                        type="text"
                                        className={styles.input}
                                        value={lastName}
                                        onChange={(e) => setLastName(e.target.value)}
                                        required
                                        disabled={isSigningUp}
                                    />
                                </div>
                                <div className={styles.inputGroup}>
                                    <label className={styles.label}>Email</label>
                                    <input
                                        type="email"
                                        className={styles.input}
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        disabled={isSigningUp}
                                    />
                                </div>
                                <div className={styles.inputGroup}>
                                    <label className={styles.label}>Password</label>
                                    <input
                                        type="password"
                                        className={styles.input}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        disabled={isSigningUp}
                                    />
                                </div>
                                <div className={styles.inputGroup}>
                                    <label className={styles.label}>Confirm Password</label>
                                    <input
                                        type="password"
                                        className={styles.input}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        required
                                        disabled={isSigningUp}
                                    />
                                </div>
                                <LoadingButton
                                    type="submit"
                                    onClick={() => {}}
                                    loading={isSigningUp}
                                    variant="success"
                                    fullWidth
                                    className={`${styles.button} ${styles.formButton}`}>
                                    {isSigningUp ? "Creating Account..." : "Sign Up"}
                                </LoadingButton>
                                <p className={styles.errorMessage}>{errorSignup}</p>
                                <p className={styles.errorMessage}>{errorSocial}</p>
                            </form>
                        </div>
                        <div className={styles.mobileToggleWrapper}>
                            <h2 className={styles.mobileToggleTitle}>Already have an account?</h2>
                            <button
                                className={styles.mobileToggleButton}
                                onClick={() => setIsSignIn(true)}
                                disabled={isSigningUp}>
                                Sign In
                            </button>
                        </div>
                    </>
                )
            ) : (
                <>
                    <div className={`${styles.formContainer} ${styles.signUpForm}`}>
                        <form onSubmit={handleSignup} className={styles.form}>
                            <h2 className={styles.title}>Sign Up</h2>
                            <div className={styles.socialButtons}>
                                <LoadingButton
                                    type="button"
                                    onClick={() => handleSocialSignin("google")}
                                    loading={isSigningInGoogle}
                                    disabled={isSigningUp || isSigningInGithub}
                                    variant="secondary"
                                    fullWidth
                                    className={`${styles.socialButton} ${styles.formButton}`}>
                                    <span className={styles.buttonContent}>
                                        <GoogleIcon className={styles.googleIcon} />
                                        <span>Continue with Google</span>
                                    </span>
                                </LoadingButton>
                                <LoadingButton
                                    type="button"
                                    onClick={() => handleSocialSignin("github")}
                                    loading={isSigningInGithub}
                                    disabled={isSigningUp || isSigningInGoogle}
                                    variant="secondary"
                                    fullWidth
                                    className={`${styles.socialButton} ${styles.formButton}`}>
                                    <span className={styles.buttonContent}>
                                        <GithubIcon className={styles.githubIcon} />
                                        <span>Continue with GitHub</span>
                                    </span>
                                </LoadingButton>
                            </div>
                            <div className={styles.divider}>
                                <span>or</span>
                            </div>
                            <div className={styles.inputGroup}>
                                <label className={styles.label}>First Name</label>
                                <input
                                    type="text"
                                    className={styles.input}
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                    required
                                    disabled={isSigningUp}
                                />
                            </div>
                            <div className={styles.inputGroup}>
                                <label className={styles.label}>Last Name</label>
                                <input
                                    type="text"
                                    className={styles.input}
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                    required
                                    disabled={isSigningUp}
                                />
                            </div>
                            <div className={styles.inputGroup}>
                                <label className={styles.label}>Email</label>
                                <input
                                    type="email"
                                    className={styles.input}
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    disabled={isSigningUp}
                                />
                            </div>
                            <div className={styles.inputGroup}>
                                <label className={styles.label}>Password</label>
                                <input
                                    type="password"
                                    className={styles.input}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    disabled={isSigningUp}
                                />
                            </div>
                            <div className={styles.inputGroup}>
                                <label className={styles.label}>Confirm Password</label>
                                <input
                                    type="password"
                                    className={styles.input}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    disabled={isSigningUp}
                                />
                            </div>
                            <LoadingButton
                                onClick={() => {}}
                                type="submit"
                                loading={isSigningUp}
                                variant="primary"
                                fullWidth
                                className={`${styles.button} ${styles.formButton}`}>
                                {isSigningUp ? "Creating Account..." : "Sign Up"}
                            </LoadingButton>
                            <p className={styles.errorMessage}>{errorSignup}</p>
                            <p className={styles.errorMessage}>{errorSocial}</p>
                        </form>
                    </div>
                    <div className={`${styles.formContainer} ${styles.signInForm}`}>
                        <form onSubmit={handleSignin} className={styles.form}>
                            <h2 className={styles.title}>Sign In</h2>
                            <div className={styles.socialButtons}>
                                <LoadingButton
                                    type="button"
                                    onClick={() => handleSocialSignin("google")}
                                    loading={isSigningInGoogle}
                                    disabled={isSigningIn || isSendingReset || isSigningInGithub}
                                    variant="secondary"
                                    fullWidth
                                    className={`${styles.socialButton} ${styles.formButton}`}>
                                    <span className={styles.buttonContent}>
                                        <GoogleIcon className={styles.googleIcon} />
                                        <span>Continue with Google</span>
                                    </span>
                                </LoadingButton>
                                <LoadingButton
                                    type="button"
                                    onClick={() => handleSocialSignin("github")}
                                    loading={isSigningInGithub}
                                    disabled={isSigningIn || isSendingReset || isSigningInGoogle}
                                    variant="secondary"
                                    fullWidth
                                    className={`${styles.socialButton} ${styles.formButton}`}>
                                    <span className={styles.buttonContent}>
                                        <GithubIcon className={styles.githubIcon} />
                                        <span>Continue with GitHub</span>
                                    </span>
                                </LoadingButton>
                            </div>
                            <div className={styles.divider}>
                                <span>or</span>
                            </div>
                            <div className={styles.inputGroup}>
                                <label className={styles.label}>Email</label>
                                <input
                                    type="email"
                                    className={styles.input}
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    disabled={isSigningIn}
                                />
                            </div>
                            <div className={styles.inputGroup}>
                                <label className={styles.label}>Password</label>
                                <input
                                    type="password"
                                    className={styles.input}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    disabled={isSigningIn}
                                />
                            </div>
                            <LoadingButton
                                onClick={() => {}}
                                type="submit"
                                loading={isSigningIn}
                                variant="primary"
                                fullWidth
                                className={`${styles.button} ${styles.formButton}`}>
                                {isSigningIn ? "Signing In..." : "Sign In"}
                            </LoadingButton>
                            <LoadingButton
                                type="button"
                                onClick={handleForgotPassword}
                                loading={isSendingReset}
                                variant="secondary"
                                fullWidth
                                className={`${styles.forgotPassword} ${styles.formButton}`}>
                                {isSendingReset ? "Sending..." : "Forgot password?"}
                            </LoadingButton>
                            <p className={styles.errorMessage}>{errorSignin}</p>
                            <p className={styles.errorMessage}>{errorSocial}</p>
                        </form>
                    </div>
                </>
            )}
            <div className={styles.toggleContainer}>
                <div className={styles.toggle}>
                    <div className={`${styles.togglePanel} ${styles.toggleLeft}`}>
                        <h2>
                            Already have <br /> an account?
                        </h2>
                        <button
                            className={styles.toggleButton}
                            onClick={() => setIsSignIn(true)}
                            disabled={isSigningUp || isSigningIn || isSendingReset}>
                            Sign In
                        </button>
                    </div>
                    <div className={`${styles.togglePanel} ${styles.toggleRight}`}>
                        <h2>
                            Need to <br /> create an account?
                        </h2>
                        <button
                            className={styles.toggleButton}
                            onClick={() => setIsSignIn(false)}
                            disabled={isSigningUp || isSigningIn || isSendingReset}>
                            Sign Up
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
