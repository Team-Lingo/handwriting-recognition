"use client";
import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import ImageUploader from "@/components/ImageUploader";
import { OcrResponse } from "@/types/ocr";
import { getDownloadURL, ref } from "firebase/storage";
import { storage } from "@/lib/firebase";

function DashboardContent() {
    const { user, userProfile, loading, signOut } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [result, setResult] = useState<OcrResponse | null>(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [imageUrl, setImageUrl] = useState<string | null>(null);

    useEffect(() => {
        if (!loading && !user) {
            router.push("/login");
        }
    }, [user, loading, router]);

    useEffect(() => {
        const analyzeFile = async () => {
            const storagePath = searchParams.get("analyze");
            if (!storagePath || !user) return;

            setAnalyzing(true);
            try {
                // Get download URL for both preview and API
                const url = await getDownloadURL(ref(storage, storagePath));
                setImageUrl(url);

                // Send download URL to OCR API - server fetches from the signed URL
                const formData = new FormData();
                formData.append("fileUrl", url);

                const ocrResponse = await fetch("/api/ocr", {
                    method: "POST",
                    body: formData,
                });
                const data: OcrResponse = await ocrResponse.json();
                setResult(data);
            } catch (error) {
                console.error("Analysis failed:", error);
                alert("Failed to analyze image. Please try again.");
            } finally {
                setAnalyzing(false);
            }
        };

        analyzeFile();
    }, [searchParams, user]);

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
                    <button onClick={() => router.push("/files")} className="btn">
                        Files
                    </button>
                    <button onClick={() => router.push("/profile")} className="btn btn-primary">
                        {userProfile?.firstName}
                    </button>
                    <button onClick={handleSignOut} className="btn btn-secondary">
                        Sign Out
                    </button>
                </div>
            </div>

            <ImageUploader />

            {analyzing && (
                <div className="card" style={{ textAlign: "center", marginTop: "1rem" }}>
                    <p>Analyzing image...</p>
                </div>
            )}

            {imageUrl && !analyzing && (
                <div className="card" style={{ textAlign: "center", marginTop: "1rem" }}>
                    <img
                        src={imageUrl}
                        alt="Analyzed image"
                        style={{ maxHeight: "220px", objectFit: "contain", margin: "0 auto" }}
                    />
                </div>
            )}

            {result && (
                <div className="result-card">
                    <p className="result-language">Detected language: {result.language}</p>
                    <div className="result-section">
                        <h3>Original Text:</h3>
                        <pre className="result-text">{result.text}</pre>
                    </div>
                    {result.correctedText && (
                        <div className="result-section">
                            <h3>Corrected Text:</h3>
                            <pre className="result-text">{result.correctedText}</pre>
                        </div>
                    )}
                    {result.accuracy !== undefined && (
                        <div className="result-section">
                            <p className="result-accuracy">Accuracy: {result.accuracy}%</p>
                        </div>
                    )}
                    {result.notes && result.notes.length > 0 && (
                        <div className="result-section">
                            <h3>Correction Notes:</h3>
                            <ul className="result-notes">
                                {result.notes.map((note, index) => (
                                    <li key={index}>{note}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </main>
    );
}

export default function DashboardPage() {
    return (
        <Suspense
            fallback={
                <div className="dashboard-container">
                    <div className="loading">Loading...</div>
                </div>
            }>
            <DashboardContent />
        </Suspense>
    );
}
