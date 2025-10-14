import LoginForm from "@/components/LoginForm";
import Link from "next/link";

export default function LoginPage() {
    return (
        <main className="auth-container">
            <LoginForm />
            <p className="auth-link">
                Don&apos;t have an account? <Link href="/register">Sign Up</Link>
            </p>
        </main>
    );
}
