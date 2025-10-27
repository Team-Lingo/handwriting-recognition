"use client";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginForm() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const { signIn, signInWithGoogle, signInWithGithub } = useAuth();
    const router = useRouter();

    const handleGoogleSignIn = async () => {
        try {
            await signInWithGoogle();
            router.push("/dashboard");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Google sign in failed");
        }
    };

    const handleGithubSignIn = async () => {
        try {
            await signInWithGithub();
            router.push("/dashboard");
        } catch (err) {
            setError(err instanceof Error ? err.message : "GitHub sign in failed");
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            await signIn(email, password);
            router.push("/dashboard");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Login failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-card">
            <h2 className="auth-title">Sign In</h2>

            <form onSubmit={handleSubmit} className="auth-form">
                <div className="form-group">
                    <label htmlFor="email">Email</label>
                    <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="form-input"
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="password">Password</label>
                    <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="form-input"
                    />
                </div>

                <div className="forgot-password-link">
                    <Link href="/forgot-password">Forgot Password?</Link>
                </div>

                {error && <p className="error-message">{error}</p>}

                <button type="submit" disabled={loading} className="btn btn-primary">
                    {loading ? "Signing In..." : "Sign In"}
                </button>

                <div className="divider">or</div>

                <button 
                    type="button" 
                    onClick={handleGoogleSignIn}
                    className="btn btn-google"
                    disabled={loading}
                >
                    <svg className="google-icon" viewBox="0 0 48 48">
                        <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
                        <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
                        <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" />
                        <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
                    </svg>
                    Sign in with Google
                </button>

                <button
                    type="button"
                    onClick={handleGithubSignIn}
                    className="btn btn-github mt-2"
                    disabled={loading}
                >
                    <svg className="github-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                        <path fill="currentColor" d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.11.82-.26.82-.58 0-.29-.01-1.05-.015-2.06-3.338.725-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.757-1.333-1.757-1.09-.745.082-.73.082-.73 1.205.085 1.84 1.237 1.84 1.237 1.072 1.835 2.81 1.305 3.495.997.11-.777.42-1.305.763-1.605-2.665-.305-5.466-1.332-5.466-5.93 0-1.31.47-2.38 1.235-3.22-.125-.303-.535-1.523.115-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.4 3-.405 1.02.005 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.655 1.653.245 2.873.12 3.176.77.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.62-5.475 5.92.43.37.81 1.096.81 2.215 0 1.6-.015 2.89-.015 3.285 0 .32.21.695.825.575C20.565 21.795 24 17.295 24 12 24 5.37 18.63 0 12 0z" />
                    </svg>
                    <span className="ml-2">Sign in with GitHub</span>
                </button>
            </form>
        </div>
    );
}
