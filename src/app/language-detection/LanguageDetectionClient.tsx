"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import DashboardHeader from "@/components/Dashboard/DashboardHeader";
import DashboardSidebar from "@/components/Dashboard/DashboardSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { MdAutoAwesome, MdLanguage, MdPercent, MdUploadFile } from "react-icons/md";

type DetectResponse = {
    language: "English" | "Arabic" | "Unknown";
    hasText: boolean;
};

function formatLanguage(lang: DetectResponse["language"], hasText: boolean): string {
    if (!hasText) return "No text detected";
    return lang;
}

export default function LanguageDetectionClient() {
    const { user, userProfile, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string>("");

    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<DetectResponse | null>(null);

    useEffect(() => {
        if (!loading && !user) {
            router.push(`/auth?next=${encodeURIComponent(pathname || "/language-detection")}`);
        }
    }, [loading, user, router, pathname]);

    useEffect(() => {
        if (!selectedFile) {
            setPreviewUrl("");
            return;
        }
        if (!selectedFile.type.startsWith("image/")) {
            setPreviewUrl("");
            return;
        }

        const url = URL.createObjectURL(selectedFile);
        setPreviewUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [selectedFile]);

    const firstName = userProfile?.firstName || user?.displayName?.split(" ")[0] || "User";

    const runDetection = async (file: File) => {
        setBusy(true);
        setError(null);
        setResult(null);

        try {
            const formData = new FormData();
            formData.append("file", file);

            const res = await fetch("/api/language-detect", { method: "POST", body: formData });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body?.error || "Language detection failed");
            }

            const data = (await res.json()) as DetectResponse;
            setResult(data);
        } catch (e) {
            setError((e as Error).message || "Language detection failed");
        } finally {
            setBusy(false);
        }
    };

    const handleUploadInput = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setSelectedFile(file);
        void runDetection(file);
    };

    const statCards = useMemo(
        () => [
            {
                title: "100+ Language",
                body: "Seamlessly identify text in over 200 languages including English, Spanish, French, Chinese, Japanese, and beyond",
                icon: <MdLanguage />,
            },
            {
                title: "AI-Based Detection",
                body: "Advanced AI models to deliver fast and highly accurate language recognition",
                icon: <MdAutoAwesome />,
            },
            {
                title: "Detection Accuracy",
                body: "Provides a clear accuracy percentage for each detected language, ensuring trustworthy results",
                icon: <MdPercent />,
            },
        ],
        [],
    );

    if (loading || !user) {
        return (
            <div className="dashboard-layout">
                <DashboardSidebar user={user} userProfile={userProfile} />
                <main className="dashboard-main">
                    <div className="loading-container">Loading...</div>
                </main>
            </div>
        );
    }

    return (
        <div className="dashboard-layout">
            <DashboardSidebar user={user} userProfile={userProfile} />
            <main className="dashboard-main">
                <div className="dashboard-content">
                    <DashboardHeader userName={firstName} />

                    <section className="dashboard-section">
                        <h2 className="section-title">Upload Image for Detection</h2>

                        <div className="ld-upload-card">
                            <input
                                ref={fileInputRef}
                                type="file"
                                className="ld-file-input"
                                accept="image/*"
                                onChange={handleUploadInput}
                            />

                            <div
                                className="ld-dropzone"
                                role="button"
                                tabIndex={0}
                                onClick={() => fileInputRef.current?.click()}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
                                }}>
                                {previewUrl ? (
                                    <img src={previewUrl} alt={selectedFile?.name || "Image"} className="ld-preview" />
                                ) : (
                                    <div className="ld-dropzone-placeholder">
                                        <div className="ld-drop-icon" aria-hidden="true">
                                            <MdUploadFile />
                                        </div>
                                        <div className="ld-drop-title">Drop your image</div>
                                        <div className="ld-drop-subtitle">or click to browse files</div>
                                        <div className="ld-drop-formats">Supported formats: PNG, JPG, JPEG, GIF</div>
                                    </div>
                                )}

                                <button
                                    type="button"
                                    className="ld-upload-btn"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        fileInputRef.current?.click();
                                    }}
                                    disabled={busy}>
                                    {busy ? "Detecting…" : "Upload Image"}
                                </button>
                            </div>

                            {(error || result) && (
                                <div className={`ld-result ${error ? "ld-result--error" : "ld-result--ok"}`}>
                                    {error ? (
                                        <span>{error}</span>
                                    ) : result ? (
                                        <span>
                                            Detected: <strong>{formatLanguage(result.language, result.hasText)}</strong>
                                        </span>
                                    ) : null}
                                </div>
                            )}
                        </div>
                    </section>

                    <section className="dashboard-section">
                        <div className="ld-stats-grid">
                            {statCards.map((c) => (
                                <div key={c.title} className="ld-stat-card">
                                    <div className="ld-stat-icon">{c.icon}</div>
                                    <div className="ld-stat-title">{c.title}</div>
                                    <div className="ld-stat-body">{c.body}</div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            </main>
        </div>
    );
}
