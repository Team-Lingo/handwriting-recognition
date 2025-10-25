"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { listUserFiles } from "@/services/filesService";
import type { UserFileRecord } from "@/types/file";
import { getDownloadURL, ref } from "firebase/storage";
import { storage } from "@/lib/firebase";

export default function FilesPage() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const [files, setFiles] = useState<UserFileRecord[]>([]);
    const [urls, setUrls] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!loading && !user) {
            router.push("/login");
        }
    }, [user, loading, router]);

    useEffect(() => {
        const load = async () => {
            if (!user) return;
            setBusy(true);
            try {
                const items = await listUserFiles(user.uid, 100);
                setFiles(items);
                // Preload download URLs (best-effort)
                const entries = await Promise.all(
                    items.map(async (item) => {
                        try {
                            const u = await getDownloadURL(ref(storage, item.storagePath));
                            return [item.fileId, u] as const;
                        } catch {
                            return [item.fileId, ""] as const;
                        }
                    })
                );
                const map: Record<string, string> = {};
                for (const [k, v] of entries) map[k] = v;
                setUrls(map);
            } finally {
                setBusy(false);
            }
        };
        load();
    }, [user]);

    const hasFiles = useMemo(() => files && files.length > 0, [files]);

    if (loading || !user) {
        return (
            <main className="dashboard-container">
                <div className="loading">Loading...</div>
            </main>
        );
    }

    return (
        <main className="dashboard-container">
            <div className="dashboard-header">
                <div>
                    <h1>Your files</h1>
                    <p>Uploaded images you can analyze later.</p>
                </div>
                <div className="flex items-center gap-4">
                    <button className="btn" onClick={() => router.push("/dashboard")}>
                        Back to Dashboard
                    </button>
                </div>
            </div>

            {!hasFiles && (
                <div className="card" style={{ textAlign: "center" }}>
                    <p>{busy ? "Loading…" : "No files yet. Upload from the dashboard to get started."}</p>
                </div>
            )}

            {hasFiles && (
                <div
                    className="files-grid"
                    style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
                    {files.map((f) => {
                        const href = urls[f.fileId];
                        const createdAt = f.createdAt?.toDate?.() || null;
                        const createdStr = createdAt ? createdAt.toLocaleString() : "";
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
                                    {href ? (
                                        <img
                                            src={href}
                                            alt={f.name}
                                            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                                        />
                                    ) : (
                                        <div style={{ color: "#888" }}>No preview</div>
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
                                </div>
                                <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                                    <button
                                        className="btn"
                                        onClick={() =>
                                            router.push(`/dashboard?analyze=${encodeURIComponent(f.storagePath)}`)
                                        }>
                                        Analyze
                                    </button>
                                    {href && (
                                        <a className="btn btn-secondary" href={href} target="_blank" rel="noreferrer">
                                            Open
                                        </a>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </main>
    );
}
