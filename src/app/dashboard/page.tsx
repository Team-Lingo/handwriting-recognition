"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import ImageUploader from "@/components/ImageUploader";
import { OcrResponse } from "@/types/ocr";

export default function DashboardPage() {
    const [result, setResult] = useState<OcrResponse | null>(null);
    const { user, userProfile, loading, signOut } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !user) {
            router.push("/login");
        }
    }, [user, loading, router]);

    if (loading) {
        return (
            <main className="dashboard-container">
                <div className="loading">Loading...</div>
            </main>
        );
    }

    if (!user) {
        return null;
    }

    const handleSignOut = async () => {
        await signOut();
        router.push("/");
    };

    return (
        <main className="dashboard-container">
            <div className="dashboard-header">
                <div>
                    <h1>Handwriting Recognition Dashboard</h1>
                    {userProfile && (
                        <p className="user-greeting">
                            Welcome, {userProfile.firstName} {userProfile.lastName}!
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => router.push('/profile')} 
                        className="btn btn-primary"
                    >
                        {userProfile?.firstName}
                    </button>
                    <button 
                        onClick={handleSignOut} 
                        className="btn btn-secondary"
                    >
                        Sign Out
                    </button>
                </div>
            </div>

            <ImageUploader onResult={setResult} />

            {result && (
                <div className="result-card">
                    <p className="result-language">Detected language: {result.language}</p>
                    <pre className="result-text">{result.text}</pre>
                </div>
            )}
        </main>
    );
}
