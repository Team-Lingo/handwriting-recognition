"use client";

import React, { useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import styles from "./authPage.module.css";
import Verification from "@/components/auth/verification";
import LoadingButton from "@/components/loading/loading/LoadingButton";
import Loader from "@/components/loading/loading/Loader";

import { auth } from "@/lib/firebase";

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
import {
  callUpdateProfile,
  callStartEmailMfa,
  callClearEmailMfa,
  callVerifyEmailMfa,
} from "@/lib/firebase/functions";

import triggerNotification from "@/lib/firebase/triggerNotification";

export default function AuthPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const rawNext = searchParams.get("next") || "/dashboard";
  const nextUrl =
    rawNext.startsWith("/api") || !rawNext.startsWith("/")
      ? "/dashboard"
      : rawNext;

  const [isSignIn, setIsSignIn] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorSignup, setErrorSignup] = useState("");
  const [errorSignin, setErrorSignin] = useState("");
  const [isMobile, setIsMobile] = useState(false);

  const [awaitingMfa, setAwaitingMfa] = useState<boolean | null>(null);
  const mfaStartedRef = useRef(false);
  const mfaVerifiedRef = useRef(false);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaError, setMfaError] = useState("");

  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [isVerifyingMfa, setIsVerifyingMfa] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [isResendingMfa, setIsResendingMfa] = useState(false);

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

  const createSession = async () => {
    const idToken = await auth.currentUser!.getIdToken();
    await fetch("/api/session-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setCurrentUser(firebaseUser);

      if (firebaseUser) {
        if (mfaVerifiedRef.current) {
          setAwaitingMfa(false);
        } else {
          setAwaitingMfa(true);

          if (!mfaStartedRef.current) {
            try {
              await callClearEmailMfa();
              await callStartEmailMfa();
              mfaStartedRef.current = true;
              setMfaError("");
            } catch {
              setMfaError("Failed to send code");
            }
          }
        }
      } else {
        setAwaitingMfa(null);
        mfaStartedRef.current = false;
        mfaVerifiedRef.current = false;
        setMfaCode("");
        setMfaError("");
      }

      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading || redirecting) return <Loader />;

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSigningUp(true);
    setErrorSignup("");

    try {
      await fetch("/api/session-logout", { method: "POST" });
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

      setEmail("");
      setPassword("");
      setFirstName("");
      setLastName("");
    } catch (err: unknown) {
      const code =
        typeof err === "object" && err !== null && "code" in err
          ? (err as { code: string }).code
          : "unknown";
      setErrorSignup(getFriendlyAuthError(code));
    } finally {
      setIsSigningUp(false);
    }
  };

  const handleSignin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSigningIn(true);
    setErrorSignin("");

    try {
      await fetch("/api/session-logout", { method: "POST" });
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
      setEmail("");
      setPassword("");
    } catch (err: unknown) {
      const code =
        typeof err === "object" && err !== null && "code" in err
          ? (err as { code: string }).code
          : "unknown";
      setErrorSignin(getFriendlyAuthError(code));
    } finally {
      setIsSigningIn(false);
    }
  };

  if (awaitingMfa === true) {
    return (
      <Verification
        code={mfaCode}
        onCodeChange={setMfaCode}
        onSubmit={async () => {
          setIsVerifyingMfa(true);
          try {
            await callVerifyEmailMfa(mfaCode);

            if (auth.currentUser) await auth.currentUser.getIdToken(true);

            mfaVerifiedRef.current = true;
            setAwaitingMfa(false);
            setRedirecting(true);

            await setPersistence(auth, browserLocalPersistence);
            if (auth.currentUser)
              await updateCurrentUser(auth, auth.currentUser);

            await createSession();
            router.push(nextUrl);
          } catch (err: unknown) {
            setMfaError((err as Error).message);
          } finally {
            setIsVerifyingMfa(false);
          }
        }}
        onResend={async () => {
          setIsResendingMfa(true);
          try {
            await callStartEmailMfa();
            setMfaError("");
          } catch {
            setMfaError("Failed to send code");
          } finally {
            setIsResendingMfa(false);
          }
        }}
        error={mfaError}
        loading={isVerifyingMfa}
        resendLoading={isResendingMfa}
      />
    );
  }

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
        typeof err === "object" && err !== null && "code" in err
          ? (err as { code: string }).code
          : "unknown";
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
                  className={styles.button}
                >
                  {isSigningIn ? "Signing In..." : "Sign In"}
                </LoadingButton>
                <LoadingButton
                  type="button"
                  onClick={handleForgotPassword}
                  loading={isSendingReset}
                  variant="secondary"
                  size="small"
                  className={styles.forgotPassword}
                >
                  {isSendingReset ? "Sending..." : "Forgot password?"}
                </LoadingButton>
                <p className={styles.errorMessage}>{errorSignin}</p>
              </form>
            </div>
            <div className={styles.mobileToggleWrapper}>
              <h2 className={styles.mobileToggleTitle}>
                Need to create an account?
              </h2>
              <button
                className={styles.mobileToggleButton}
                onClick={() => setIsSignIn(false)}
                disabled={isSigningIn || isSendingReset}
              >
                Sign Up
              </button>
            </div>
          </>
        ) : (
          <>
            <div className={`${styles.formContainer} ${styles.signUpForm}`}>
              <form onSubmit={handleSignup} className={styles.form}>
                <h2 className={styles.title}>Sign Up</h2>
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
                  className={styles.button}
                >
                  {isSigningUp ? "Creating Account..." : "Sign Up"}
                </LoadingButton>
                <p className={styles.errorMessage}>{errorSignup}</p>
              </form>
            </div>
            <div className={styles.mobileToggleWrapper}>
              <h2 className={styles.mobileToggleTitle}>
                Already have an account?
              </h2>
              <button
                className={styles.mobileToggleButton}
                onClick={() => setIsSignIn(true)}
                disabled={isSigningUp}
              >
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
                className={styles.button}
              >
                {isSigningUp ? "Creating Account..." : "Sign Up"}
              </LoadingButton>
              <p className={styles.errorMessage}>{errorSignup}</p>
            </form>
          </div>
          <div className={`${styles.formContainer} ${styles.signInForm}`}>
            <form onSubmit={handleSignin} className={styles.form}>
              <h2 className={styles.title}>Sign In</h2>
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
                className={styles.button}
              >
                {isSigningIn ? "Signing In..." : "Sign In"}
              </LoadingButton>
              <LoadingButton
                type="button"
                onClick={handleForgotPassword}
                loading={isSendingReset}
                variant="secondary"
                size="small"
                className={styles.forgotPassword}
              >
                {isSendingReset ? "Sending..." : "Forgot password?"}
              </LoadingButton>
              <p className={styles.errorMessage}>{errorSignin}</p>
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
              disabled={isSigningUp || isSigningIn || isSendingReset}
            >
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
              disabled={isSigningUp || isSigningIn || isSendingReset}
            >
              Sign Up
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
