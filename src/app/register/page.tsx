import RegisterForm from "@/components/RegisterForm";
import Link from "next/link";

export default function RegisterPage() {
    return (
        <main className="auth-container">
            <RegisterForm />
            <p className="auth-link">
                Already have an account? <Link href="/login">Sign In</Link>
            </p>
        </main>
    );
}
