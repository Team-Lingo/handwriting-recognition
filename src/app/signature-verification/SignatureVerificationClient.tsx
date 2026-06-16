"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import DashboardHeader from "@/components/Dashboard/DashboardHeader";
import DashboardSidebar from "@/components/Dashboard/DashboardSidebar";
import { useAuth } from "@/contexts/AuthContext";
import {
    MdAutoAwesome,
    MdCheckCircle,
    MdCancel,
    MdDraw,
    MdSecurity,
    MdUploadFile,
} from "react-icons/md";
import { ref as storageRef, uploadBytes } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { setUserFileFailed, upsertUserFileRecord } from "@/services/filesService";
import { serverTimestamp } from "firebase/firestore";

type VerifyResponse = {
    similarity: number;
    is_genuine: boolean;
};

type SlotKey = "reference" | "test";

export default function SignatureVerificationClient() {
    const { user, userProfile, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    const refInputRef = useRef<HTMLInputElement | null>(null);
    const testInputRef = useRef<HTMLInputElement | null>(null);

    const [referenceFile, setReferenceFile] = useState<File | null>(null);
    const [testFile, setTestFile] = useState<File | null>(null);
    const [referencePreview, setReferencePreview] = useState<string>("");
    const [testPreview, setTestPreview] = useState<string>("");

    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<VerifyResponse | null>(null);

    const createFileId = () =>
        globalThis.crypto && "randomUUID" in globalThis.crypto
            ? globalThis.crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    useEffect(() => {
        if (!loading && !user) {
            router.push(`/auth?next=${encodeURIComponent(pathname || "/signature-verification")}`);
        }
    }, [loading, user, router, pathname]);

    useEffect(() => {
        if (!referenceFile || !referenceFile.type.startsWith("image/")) {
            setReferencePreview("");
            return;
        }
        const url = URL.createObjectURL(referenceFile);
        setReferencePreview(url);
        return () => URL.revokeObjectURL(url);
    }, [referenceFile]);

    useEffect(() => {
        if (!testFile || !testFile.type.startsWith("image/")) {
            setTestPreview("");
            return;
        }
        const url = URL.createObjectURL(testFile);
        setTestPreview(url);
        return () => URL.revokeObjectURL(url);
    }, [testFile]);

    const firstName = userProfile?.firstName || user?.displayName?.split(" ")[0] || "User";

    const handlePick = (slot: SlotKey, event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (slot === "reference") setReferenceFile(file);
        else setTestFile(file);
        setResult(null);
        setError(null);
    };

    const uploadAndRecord = async (file: File, role: SlotKey): Promise<string | null> => {
        if (!user) return null;
        const fileId = createFileId();
        const ext = file.name.includes(".") ? `.${file.name.split(".").pop()}` : "";
        const storagePath = `users/${user.uid}/files/${fileId}${ext}`;
        await uploadBytes(storageRef(storage, storagePath), file, {
            contentType: file.type,
            customMetadata: { originalName: file.name, role: `signature-${role}` },
        });
        await upsertUserFileRecord(user.uid, fileId, {
            name: file.name,
            storagePath,
            bucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
            contentType: file.type || null,
            size: file.size,
            status: "uploaded",
            category: role === "reference" ? "Signature (Reference)" : "Signature (Test)",
        });
        return fileId;
    };

    const runVerification = async () => {
        if (!referenceFile || !testFile) {
            setError("Please upload both a reference and a test signature image.");
            return;
        }
        setBusy(true);
        setError(null);
        setResult(null);

        let refFileId: string | null = null;
        let testFileId: string | null = null;

        try {
            if (!user) throw new Error("Please sign in to verify signatures.");

            [refFileId, testFileId] = await Promise.all([
                uploadAndRecord(referenceFile, "reference"),
                uploadAndRecord(testFile, "test"),
            ]);

            const formData = new FormData();
            formData.append("reference", referenceFile);
            formData.append("test", testFile);

            const res = await fetch("/api/verify-signature", { method: "POST", body: formData });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body?.error || "Signature verification failed");
            }

            const data = (await res.json()) as VerifyResponse;
            setResult(data);

            const verdict = data.is_genuine ? "Genuine" : "Forged";
            const summary = `${verdict} — ${data.similarity.toFixed(2)}% similarity`;

            await Promise.all(
                [refFileId, testFileId].map((id) =>
                    id
                        ? upsertUserFileRecord(user.uid, id, {
                              status: "analyzed",
                              analyzedAt: serverTimestamp(),
                              ocrLanguage: summary,
                              ocrAccuracy: data.similarity,
                          })
                        : Promise.resolve(),
                ),
            );
        } catch (e) {
            const message = (e as Error).message || "Signature verification failed";
            setError(message);
            if (user) {
                await Promise.all(
                    [refFileId, testFileId].map(async (id) => {
                        if (!id) return;
                        try {
                            await setUserFileFailed(user.uid, id, message);
                        } catch {
                            /* ignore */
                        }
                    }),
                );
            }
        } finally {
            setBusy(false);
        }
    };

    const handleReset = () => {
        setReferenceFile(null);
        setTestFile(null);
        setResult(null);
        setError(null);
    };

    const statCards = useMemo(
        () => [
            {
                title: "Siamese AI Model",
                body: "Deep learning model trained to compare signature pairs and quantify visual similarity.",
                icon: <MdAutoAwesome />,
            },
            {
                title: "Forgery Detection",
                body: "Distinguishes between genuine signatures and skilled forgeries using a calibrated threshold.",
                icon: <MdSecurity />,
            },
            {
                title: "Similarity Score",
                body: "Provides an interpretable similarity percentage to help you assess authenticity at a glance.",
                icon: <MdDraw />,
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
                        <h2 className="section-title">Signature Verification</h2>
                        <p className="history-subtitle" style={{ marginBottom: 16 }}>
                            Upload a known-genuine reference signature and the signature you want to verify. The AI
                            model will compare them and tell you whether the test signature is likely genuine.
                        </p>

                        <div className="sv-upload-grid">
                            <div className="sv-slot">
                                <div className="sv-slot-label">Reference signature</div>
                                <div className="sv-slot-sub">A known-genuine signature for comparison.</div>
                                <input
                                    ref={refInputRef}
                                    type="file"
                                    className="sv-file-input"
                                    accept="image/*"
                                    onChange={(e) => handlePick("reference", e)}
                                />
                                <div
                                    className="sv-dropzone"
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => refInputRef.current?.click()}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" || e.key === " ") refInputRef.current?.click();
                                    }}>
                                    {referencePreview ? (
                                        <img
                                            src={referencePreview}
                                            alt={referenceFile?.name || "Reference"}
                                            className="sv-preview"
                                        />
                                    ) : (
                                        <div className="sv-dropzone-placeholder">
                                            <div className="sv-drop-icon" aria-hidden="true">
                                                <MdUploadFile />
                                            </div>
                                            <div className="ld-drop-title">Upload reference</div>
                                            <div className="ld-drop-subtitle">PNG, JPG, JPEG</div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="sv-slot">
                                <div className="sv-slot-label">Signature to verify</div>
                                <div className="sv-slot-sub">The signature whose legitimacy you want to check.</div>
                                <input
                                    ref={testInputRef}
                                    type="file"
                                    className="sv-file-input"
                                    accept="image/*"
                                    onChange={(e) => handlePick("test", e)}
                                />
                                <div
                                    className="sv-dropzone"
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => testInputRef.current?.click()}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" || e.key === " ") testInputRef.current?.click();
                                    }}>
                                    {testPreview ? (
                                        <img
                                            src={testPreview}
                                            alt={testFile?.name || "Test"}
                                            className="sv-preview"
                                        />
                                    ) : (
                                        <div className="sv-dropzone-placeholder">
                                            <div className="sv-drop-icon" aria-hidden="true">
                                                <MdUploadFile />
                                            </div>
                                            <div className="ld-drop-title">Upload signature</div>
                                            <div className="ld-drop-subtitle">PNG, JPG, JPEG</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="sv-actions">
                            <button
                                type="button"
                                className="sv-verify-btn"
                                onClick={() => void runVerification()}
                                disabled={busy || !referenceFile || !testFile}>
                                {busy ? "Verifying…" : "Verify signature"}
                            </button>
                            <button
                                type="button"
                                className="sv-reset-btn"
                                onClick={handleReset}
                                disabled={busy || (!referenceFile && !testFile && !result && !error)}>
                                Reset
                            </button>
                        </div>

                        {error && (
                            <div className="sv-result sv-result--error">
                                <MdCancel className="sv-result-icon sv-result-icon--bad" />
                                <div>
                                    <div className="sv-result-title">Verification failed</div>
                                    <div className="sv-result-sub">{error}</div>
                                </div>
                            </div>
                        )}

                        {result && !error && (
                            <div
                                className={`sv-result ${
                                    result.is_genuine ? "sv-result--genuine" : "sv-result--forged"
                                }`}>
                                {result.is_genuine ? (
                                    <MdCheckCircle className="sv-result-icon sv-result-icon--ok" />
                                ) : (
                                    <MdCancel className="sv-result-icon sv-result-icon--bad" />
                                )}
                                <div>
                                    <div className="sv-result-title">
                                        {result.is_genuine ? "Likely genuine" : "Likely forged"}
                                    </div>
                                    <div className="sv-result-sub">
                                        Similarity score: <strong>{result.similarity.toFixed(2)}%</strong>
                                    </div>
                                </div>
                            </div>
                        )}
                    </section>

                    <section className="dashboard-section">
                        <div className="sv-stats-grid">
                            {statCards.map((c) => (
                                <div key={c.title} className="sv-stat-card">
                                    <div className="sv-stat-icon">{c.icon}</div>
                                    <div className="sv-stat-title">{c.title}</div>
                                    <div className="sv-stat-body">{c.body}</div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            </main>
        </div>
    );
}
