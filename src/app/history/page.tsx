"use client";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import DashboardSidebar from "@/components/Dashboard/DashboardSidebar";
import DashboardHeader from "@/components/Dashboard/DashboardHeader";
import { listUserFiles } from "@/services/filesService";
import type { UserFileRecord } from "@/types/file";
import { getDownloadURL, ref } from "firebase/storage";
import { storage } from "@/lib/firebase";
import "../dashboard-new/dashboard.css";

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

export default function HistoryPage() {
    const { user, userProfile, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [files, setFiles] = useState<UserFileRecord[]>([]);
    const [urls, setUrls] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false);
    const [viewing, setViewing] = useState<UserFileRecord | null>(null);

    useEffect(() => {
        if (!loading && !user) {
            router.push(`/auth?next=${encodeURIComponent(pathname || "/history")}`);
        }
    }, [user, loading, router, pathname]);

    const load = async () => {
        if (!user) return;
        setBusy(true);
        try {
            const items = await listUserFiles(user.uid, 100);
            setFiles(items);

            const entries = await Promise.all(
                items.map(async (item) => {
                    try {
                        const u = await getDownloadURL(ref(storage, item.storagePath));
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
            setBusy(false);
        }
    };

    useEffect(() => {
        void load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    const hasFiles = useMemo(() => files && files.length > 0, [files]);

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

    const firstName = userProfile?.firstName || user.displayName?.split(" ")[0] || "User";

    const viewingUrl = viewing ? urls[viewing.fileId] : "";
    const viewingCreatedAt = viewing?.createdAt?.toDate?.() || null;
    const viewingAnalyzedAt = viewing?.analyzedAt?.toDate?.() || null;
    const viewingText = viewing?.ocr?.correctedText || viewing?.ocr?.text || "";
    const viewingNotes = viewing?.ocr?.notes || [];

    return (
        <div className="dashboard-layout">
            <DashboardSidebar user={user} userProfile={userProfile} />
            <main className="dashboard-main">
                <div className="dashboard-content">
                    <DashboardHeader userName={firstName} />

                    <section className="dashboard-section">
                        <div
                            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                            <h2 className="section-title">History</h2>
                        </div>

                        {!hasFiles && (
                            <div className="card" style={{ textAlign: "center" }}>
                                <p>
                                    {busy
                                        ? "Loading…"
                                        : "No documents yet. Upload from Quick Text Recognition to get started."}
                                </p>
                            </div>
                        )}

                        {hasFiles && (
                            <div
                                className="files-grid"
                                style={{
                                    display: "grid",
                                    gap: 16,
                                    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                                }}>
                                {files.map((f) => {
                                    const href = urls[f.fileId];
                                    const createdAt = f.createdAt?.toDate?.() || null;
                                    const createdStr = createdAt
                                        ? `${createdAt.toLocaleString()} (${timeAgo(createdAt)})`
                                        : "";
                                    const sizeKb = f.size ? Math.round((f.size / 1024) * 10) / 10 : null;

                                    return (
                                        <div key={f.fileId} className="card" style={{ padding: 12 }}>
                                            <div
                                                style={{
                                                    height: 160,
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    background: "#f8f8f8",
                                                }}>
                                                {href && (f.contentType || "").startsWith("image/") ? (
                                                    <img
                                                        src={href}
                                                        alt={f.name}
                                                        style={{
                                                            maxWidth: "100%",
                                                            maxHeight: "100%",
                                                            objectFit: "contain",
                                                        }}
                                                    />
                                                ) : (
                                                    <div style={{ color: "#888", fontWeight: 600 }}>
                                                        {(f.contentType || "").includes("pdf")
                                                            ? "PDF"
                                                            : f.name.toLowerCase().endsWith(".pptx")
                                                              ? "PPTX"
                                                              : "File"}
                                                    </div>
                                                )}
                                            </div>

                                            <div style={{ marginTop: 8 }}>
                                                <div
                                                    title={f.name}
                                                    style={{
                                                        fontWeight: 600,
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                        whiteSpace: "nowrap",
                                                    }}>
                                                    {f.name}
                                                </div>
                                                <div style={{ fontSize: 12, color: "#666" }}>
                                                    {f.contentType || ""}
                                                    {sizeKb ? ` • ${sizeKb} KB` : ""}
                                                </div>
                                                <div style={{ fontSize: 12, color: "#666" }}>{createdStr}</div>
                                                <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                                                    Status: {f.status}
                                                    {f.ocr?.language ? ` • ${f.ocr.language}` : ""}
                                                    {typeof f.ocr?.accuracy === "number" ? ` • ${f.ocr.accuracy}%` : ""}
                                                </div>
                                            </div>

                                            <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                                                <button className="btn btn-primary" onClick={() => setViewing(f)}>
                                                    View
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>

                    {viewing && (
                        <div
                            role="dialog"
                            aria-modal="true"
                            onClick={() => setViewing(null)}
                            style={{
                                position: "fixed",
                                inset: 0,
                                background: "rgba(0, 0, 0, 0.5)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                padding: 16,
                                zIndex: 50,
                            }}>
                            <div
                                className="card"
                                onClick={(e) => e.stopPropagation()}
                                style={{ width: "min(920px, 100%)", maxHeight: "90vh", overflow: "auto" }}>
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        gap: 12,
                                    }}>
                                    <div style={{ minWidth: 0 }}>
                                        <div
                                            style={{
                                                fontWeight: 700,
                                                fontSize: 16,
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                            }}>
                                            {viewing.name}
                                        </div>
                                        <div style={{ fontSize: 12, color: "#666" }}>
                                            Status: {viewing.status}
                                            {viewing.ocr?.language ? ` • ${viewing.ocr.language}` : ""}
                                            {typeof viewing.ocr?.accuracy === "number"
                                                ? ` • ${viewing.ocr.accuracy}%`
                                                : ""}
                                        </div>
                                        <div style={{ fontSize: 12, color: "#666" }}>
                                            {viewingCreatedAt ? `Uploaded: ${viewingCreatedAt.toLocaleString()}` : ""}
                                            {viewingAnalyzedAt
                                                ? ` • Analyzed: ${viewingAnalyzedAt.toLocaleString()}`
                                                : ""}
                                        </div>
                                    </div>

                                    <button className="btn" onClick={() => setViewing(null)}>
                                        Close
                                    </button>
                                </div>

                                <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
                                    {viewingUrl && (viewing.contentType || "").startsWith("image/") && (
                                        <div
                                            style={{
                                                height: 260,
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                background: "#f8f8f8",
                                            }}>
                                            <img
                                                src={viewingUrl}
                                                alt={viewing.name}
                                                style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                                            />
                                        </div>
                                    )}

                                    {viewing.status === "failed" && viewing.errorMessage && (
                                        <div
                                            className="card"
                                            style={{ background: "#fff5f5", border: "1px solid #ffd1d1" }}>
                                            <div style={{ fontWeight: 700, marginBottom: 6 }}>Error</div>
                                            <div style={{ whiteSpace: "pre-wrap" }}>{viewing.errorMessage}</div>
                                        </div>
                                    )}

                                    <div className="card" style={{ background: "#fafafa" }}>
                                        <div style={{ fontWeight: 700, marginBottom: 6 }}>Extracted Text</div>
                                        <div style={{ whiteSpace: "pre-wrap" }}>
                                            {viewingText || "No extracted text saved for this document."}
                                        </div>
                                    </div>

                                    {viewingNotes.length > 0 && (
                                        <div className="card" style={{ background: "#fafafa" }}>
                                            <div style={{ fontWeight: 700, marginBottom: 6 }}>Notes</div>
                                            <ul style={{ margin: 0, paddingLeft: 18 }}>
                                                {viewingNotes.map((n, idx) => (
                                                    <li key={idx} style={{ marginBottom: 4 }}>
                                                        {n}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
