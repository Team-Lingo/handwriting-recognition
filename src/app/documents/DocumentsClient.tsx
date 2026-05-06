"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";

import DashboardHeader from "@/components/Dashboard/DashboardHeader";
import DashboardSidebar from "@/components/Dashboard/DashboardSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { storage } from "@/lib/firebase";
import {
    getUserFile,
    listUserFiles,
    setUserFileFailed,
    setUserFileOcrResult,
    upsertUserFileRecord,
} from "@/services/filesService";
import type { UserFileRecord } from "@/types/file";
import type { OcrResponse } from "@/types/ocr";
import { MdUploadFile } from "react-icons/md";

function timeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hr ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? "" : "s"} ago`;
}

function createFileId() {
    return globalThis.crypto && "randomUUID" in globalThis.crypto
        ? globalThis.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function safePercent(v: unknown): string {
    return typeof v === "number" && Number.isFinite(v) ? `${v}%` : "—";
}

export default function DocumentsClient() {
    const { user, userProfile, loading, refreshUserProfile } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const requestedFileId = searchParams.get("fileId");

    const [files, setFiles] = useState<UserFileRecord[]>([]);
    const [urls, setUrls] = useState<Record<string, string>>({});
    const [activeFile, setActiveFile] = useState<UserFileRecord | null>(null);
    const [activeUrl, setActiveUrl] = useState<string>("");

    const [busyList, setBusyList] = useState(false);
    const [busyUpload, setBusyUpload] = useState(false);
    const [busyAnalyze, setBusyAnalyze] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        if (!loading && !user) {
            router.push(`/auth?next=${encodeURIComponent(pathname || "/documents")}`);
        }
    }, [loading, user, router, pathname]);

    const loadFiles = async () => {
        if (!user) return;
        setBusyList(true);
        try {
            const items = await listUserFiles(user.uid, 100);
            setFiles(items);

            const entries = await Promise.all(
                items.map(async (item) => {
                    try {
                        const u = await getDownloadURL(storageRef(storage, item.storagePath));
                        return [item.fileId, u] as const;
                    } catch {
                        return [item.fileId, ""] as const;
                    }
                }),
            );
            const map: Record<string, string> = {};
            for (const [k, v] of entries) map[k] = v;
            setUrls(map);
        } finally {
            setBusyList(false);
        }
    };

    useEffect(() => {
        void loadFiles();
    }, [user]);

    useEffect(() => {
        if (!user) return;
        if (!requestedFileId) return;

        const select = async () => {
            const existing = files.find((f) => f.fileId === requestedFileId) || null;
            const rec = existing || (await getUserFile(user.uid, requestedFileId));
            if (!rec) return;

            setActiveFile(rec);
            const cached = urls[rec.fileId];
            if (cached) {
                setActiveUrl(cached);
            } else {
                try {
                    const u = await getDownloadURL(storageRef(storage, rec.storagePath));
                    setUrls((prev) => ({ ...prev, [rec.fileId]: u }));
                    setActiveUrl(u);
                } catch {
                    setActiveUrl("");
                }
            }
        };

        void select();
    }, [user, requestedFileId, files, urls]);

    const analyzeExisting = async (rec: UserFileRecord, url: string) => {
        if (!user) return;
        if (!url) return;
        if (busyAnalyze) return;
        if (rec.status === "analyzed" && rec.ocr) return;

        setBusyAnalyze(true);
        setError(null);
        try {
            const formData = new FormData();
            formData.append("fileUrl", url);
            const res = await fetch("/api/ocr", { method: "POST", body: formData });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body?.error || "OCR failed");
            }

            const data: OcrResponse = await res.json();
            await setUserFileOcrResult(user.uid, rec.fileId, data);
            await refreshUserProfile();

            const next = await getUserFile(user.uid, rec.fileId);
            if (next) setActiveFile(next);
            await loadFiles();
        } catch (e) {
            const message = (e as Error).message || "Failed to analyze";
            setError(message);
            try {
                await setUserFileFailed(user.uid, rec.fileId, message);
            } catch {
                // ignore
            }
        } finally {
            setBusyAnalyze(false);
        }
    };

    useEffect(() => {
        if (!user) return;
        if (!activeFile) return;
        if (!activeUrl) return;
        if (activeFile.status === "failed") return;
        if (activeFile.status === "analyzed" && activeFile.ocr) return;

        void analyzeExisting(activeFile, activeUrl);
    }, [user, activeFile?.fileId, activeUrl]);

    const firstName = userProfile?.firstName || user?.displayName?.split(" ")[0] || "User";

    const activeText = activeFile?.ocr?.correctedText || activeFile?.ocr?.text || "";
    const activeNotes = activeFile?.ocr?.notes || [];

    const hasActivePreview = Boolean(activeUrl) && (activeFile?.contentType || "").startsWith("image/");

    const exportToDocx = async () => {
        if (!activeText) return;
        
        try {
            const fileName = activeFile?.name 
                ? `${activeFile.name.split('.')[0]}_extracted.docx` 
                : "document_extracted.docx";
            
            const response = await fetch("/api/export-docx", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: activeText, filename: fileName }),
            });

            if (!response.ok) {
                throw new Error("Failed to generate DOCX on the server");
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Error exporting DOCX:", error);
            setError("Failed to export as DOCX");
        }
    };

    const exportToTxt = () => {
        if (!activeText) return;
        
        try {
            const fileName = activeFile?.name 
                ? `${activeFile.name.split('.')[0]}_extracted.txt` 
                : "document_extracted.txt";
                
            const blob = new Blob([activeText], { type: "text/plain;charset=utf-8" });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Error exporting TXT:", error);
            setError("Failed to export as TXT");
        }
    };

    const fileCards = useMemo(() => {
        return files.map((f) => {
            const createdAt = f.createdAt?.toDate?.() || null;
            const createdLabel = createdAt ? `${createdAt.toLocaleDateString()} (${timeAgo(createdAt)})` : "";
            return {
                file: f,
                createdLabel,
                status: f.status,
                language: f.ocr?.language || "—",
            };
        });
    }, [files]);

    const openFile = (f: UserFileRecord) => {
        router.push(`/documents?fileId=${encodeURIComponent(f.fileId)}`);
    };

    const runRecognition = async (file: File) => {
        if (!user) {
            setError("Please sign in to upload documents.");
            return;
        }

        setBusyUpload(true);
        setError(null);

        const fileId = createFileId();
        const ext = file.name.includes(".") ? `.${file.name.split(".").pop()}` : "";
        const storagePath = `users/${user.uid}/files/${fileId}${ext}`;

        try {
            await uploadBytes(storageRef(storage, storagePath), file, {
                contentType: file.type,
                customMetadata: { originalName: file.name },
            });

            await upsertUserFileRecord(user.uid, fileId, {
                name: file.name,
                storagePath,
                bucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
                contentType: file.type || null,
                size: file.size,
                status: "uploaded",
                category: "Documents",
            });

            const formData = new FormData();
            formData.append("file", file);
            const res = await fetch("/api/ocr", { method: "POST", body: formData });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body?.error || "OCR failed");
            }

            const data: OcrResponse = await res.json();
            await setUserFileOcrResult(user.uid, fileId, data);
            await refreshUserProfile();

            await loadFiles();
            router.push(`/documents?fileId=${encodeURIComponent(fileId)}`);
        } catch (e) {
            const message = (e as Error).message || "Failed to upload";
            setError(message);
            try {
                await setUserFileFailed(user.uid, fileId, message);
            } catch {
                // ignore
            }
        } finally {
            setBusyUpload(false);
        }
    };

    const handleUploadInput = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        void runRecognition(file);
    };

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
                        <h2 className="section-title">Upload Handwriting Documents</h2>
                        <p className="documents-subtitle">
                            Upload your handwriting samples for recognition and analysis
                        </p>

                        <div className="documents-upload-card">
                            <input
                                ref={fileInputRef}
                                type="file"
                                className="documents-file-input"
                                accept="image/*,application/pdf,.pptx"
                                onChange={handleUploadInput}
                            />

                            <div
                                className="documents-dropzone"
                                role="button"
                                tabIndex={0}
                                onClick={() => fileInputRef.current?.click()}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
                                }}>
                                {hasActivePreview ? (
                                    <img
                                        src={activeUrl}
                                        alt={activeFile?.name || "Document"}
                                        className="documents-preview"
                                    />
                                ) : (
                                    <div className="documents-dropzone-placeholder">
                                        <div className="documents-drop-icon" aria-hidden="true">
                                            <MdUploadFile />
                                        </div>
                                        <div className="documents-drop-title">Drop your file</div>
                                        <div className="documents-drop-subtitle">or click to browse files</div>
                                        <div className="documents-drop-formats">
                                            Supported formats: PNG, JPG, JPEG, GIF, PDF, PPTX
                                        </div>
                                    </div>
                                )}

                                <button
                                    type="button"
                                    className="documents-upload-btn"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        fileInputRef.current?.click();
                                    }}
                                    disabled={busyUpload}>
                                    {busyUpload ? "Uploading…" : "Upload Document"}
                                </button>
                            </div>
                        </div>

                        {error && <div className="documents-error">{error}</div>}
                    </section>

                    {activeFile && (
                        <section className="dashboard-section">
                            <h2 className="section-title">Full report</h2>

                            {busyAnalyze && (
                                <div className="documents-report-muted" style={{ marginBottom: 12 }}>
                                    Generating analysis…
                                </div>
                            )}

                            <div className="documents-report-grid">
                                <div className="documents-report-card">
                                    <div className="documents-report-title">Details</div>
                                    <div className="documents-kv">
                                        <div className="documents-k">File name</div>
                                        <div className="documents-v">{activeFile.name}</div>
                                        <div className="documents-k">Status</div>
                                        <div className="documents-v">
                                            {busyAnalyze ? "analyzing" : activeFile.status}
                                        </div>
                                        <div className="documents-k">Language</div>
                                        <div className="documents-v">{activeFile.ocr?.language || "—"}</div>
                                        <div className="documents-k">Accuracy</div>
                                        <div className="documents-v">{safePercent(activeFile.ocr?.accuracy)}</div>
                                    </div>
                                </div>

                                <div className="documents-report-card">
                                    <div className="documents-report-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span>Extracted Text</span>
                                        {activeText && (
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button 
                                                    onClick={exportToTxt}
                                                    className="documents-upload-btn"
                                                    style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem', width: 'auto', marginTop: 0 }}
                                                    title="Export text to TXT file"
                                                >
                                                    Export TXT
                                                </button>
                                                <button 
                                                    onClick={exportToDocx}
                                                    className="documents-upload-btn"
                                                    style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem', width: 'auto', marginTop: 0 }}
                                                    title="Export text to DOCX file"
                                                >
                                                    Export DOCX
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="documents-report-text">
                                        {activeText || "No extracted text saved for this document."}
                                    </div>
                                </div>

                                <div className="documents-report-card documents-report-card--full">
                                    <div className="documents-report-title">Notes</div>
                                    {activeNotes.length ? (
                                        <ul className="documents-notes">
                                            {activeNotes.map((n, idx) => (
                                                <li key={idx}>{n}</li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <div className="documents-report-muted">No notes for this document.</div>
                                    )}
                                </div>
                            </div>
                        </section>
                    )}

                    <section className="dashboard-section">
                        <h2 className="section-title">Previously Uploaded Files</h2>

                        {busyList && <div className="documents-report-muted">Loading…</div>}

                        {!busyList && files.length === 0 && (
                            <div className="documents-report-muted">No documents yet. Upload one above.</div>
                        )}

                        {files.length > 0 && (
                            <div className="documents-cards">
                                {fileCards.map(({ file, createdLabel, status, language }) => (
                                    <button
                                        key={file.fileId}
                                        type="button"
                                        className={`documents-file-card ${file.fileId === activeFile?.fileId ? "active" : ""}`}
                                        onClick={() => openFile(file)}>
                                        <div className="documents-file-name" title={file.name}>
                                            {file.name}
                                        </div>
                                        <div className="documents-file-meta">{createdLabel}</div>
                                        <div className="documents-file-status">
                                            <span className={`pill pill-${status}`}>{status}</span>
                                            <span className="documents-file-lang">{language}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            </main>
        </div>
    );
}
