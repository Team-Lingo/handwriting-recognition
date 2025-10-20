"use client";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

export default function ForgotPasswordForm() {
    const [email, setEmail] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [loading, setLoading] = useState(false);

    const { resetPassword } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setSuccess("");
        setLoading(true);

        try {
            await resetPassword(email);
            setSuccess("Password reset email sent! Please check your inbox.");
            setEmail("");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to send password reset email");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-card">
            <h2 className="auth-title">Reset Password</h2>
            <p className="auth-description">
                Enter your email address and we&apos;ll send you a link to reset your password.
            </p>

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
                        placeholder="Enter your email"
                    />
                </div>

                {error && <p className="error-message">{error}</p>}
                {success && <p className="success-message">{success}</p>}

                <button type="submit" disabled={loading} className="btn btn-primary">
                    {loading ? "Sending..." : "Send Reset Link"}
                </button>
            </form>
        </div>
    );
}
