"use client";
import { useRouter } from "next/navigation";

export default function HomePage() {
    const router = useRouter();

    return (
        <main className="landing-container">
            <div className="landing-content">
                <h1 className="landing-title">Handwriting Recognition</h1>
                <p className="landing-subtitle">Transform handwritten text into digital format using AI</p>

                <div className="landing-buttons">
                    <button onClick={() => router.push("/register")} className="btn btn-primary">
                        Register
                    </button>
                    <button onClick={() => router.push("/login")} className="btn btn-secondary">
                        Login
                    </button>
                </div>
            </div>
        </main>
    );
}
