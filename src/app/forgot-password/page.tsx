import ForgotPasswordForm from "@/components/ForgotPasswordForm";
import Link from "next/link";

export default function ForgotPasswordPage() {
    return (
        <main className="auth-container">
            <ForgotPasswordForm />
            <p className="auth-link">
                Remember your password? <Link href="/login">Sign In</Link>
            </p>
        </main>
    );
}
