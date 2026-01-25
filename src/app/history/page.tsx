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
import "../dashboard/dashboard.css";
import "./history.css";

import { MdCheck, MdClose, MdHourglassEmpty, MdInsertDriveFile, MdPictureAsPdf } from "react-icons/md";
import { FaFileWord } from "react-icons/fa";

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
    const [page, setPage] = useState(1);

    const pageSize = 10;

    useEffect(() => {
        if (!loading && !user) {
            router.push(`/auth?next=${encodeURIComponent(pathname || "/history")}`);
        }
    }, [user, loading, router, pathname]);

    useEffect(() => {
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

        void load();
    }, [user]);

    const hasFiles = files.length > 0;
    const totalPages = useMemo(() => Math.max(1, Math.ceil(files.length / pageSize)), [files.length]);
    const currentPage = Math.min(page, totalPages);
    const pageItems = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return files.slice(start, start + pageSize);
    }, [files, currentPage]);

    useEffect(() => {
        setPage(1);
    }, [files.length]);

    const statusLabel = (f: UserFileRecord) => {
        if (f.status === "analyzed") return "Completed";
        if (f.status === "failed") return "Failed";
        return "In Progress";
    };

    const categoryLabel = (f: UserFileRecord) => {
        if (f.category) return f.category;
        if (f.ocr) return "OCR";
        return "Document";
    };

    const FileThumb = ({ f }: { f: UserFileRecord }) => {
        const url = urls[f.fileId];
        const isImage = Boolean(url) && (f.contentType || "").startsWith("image/");
        const name = (f.name || "").toLowerCase();

        if (isImage) {
            return (
                <div className="history-thumb">
                    <img src={url} alt={f.name} />
                </div>
            );
        }

        const icon =
            name.endsWith(".pdf") || (f.contentType || "").includes("pdf") ? (
                <MdPictureAsPdf size={22} />
            ) : name.endsWith(".doc") || name.endsWith(".docx") ? (
                <FaFileWord size={20} />
            ) : (
                <MdInsertDriveFile size={22} />
            );

        return <div className="history-thumb">{icon}</div>;
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

    const firstName = userProfile?.firstName || user.displayName?.split(" ")[0] || "User";

    return (
        <div className="dashboard-layout">
            <DashboardSidebar user={user} userProfile={userProfile} />
            <main className="dashboard-main">
                <div className="dashboard-content">
                    <DashboardHeader userName={firstName} />

                    <section className="dashboard-section">
                        <div className="history-header">
                            <div>
                                <h2 className="section-title">Document History</h2>
                                <p className="history-subtitle">
                                    View all your uploaded handwriting files and their current status
                                </p>
                            </div>
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
                            <>
                                <div className="history-table-card">
                                    <table className="history-table">
                                        <thead>
                                            <tr>
                                                <th>File Name</th>
                                                <th>Data Uploaded</th>
                                                <th>Category</th>
                                                <th>Status</th>
                                                <th style={{ textAlign: "right" }}>Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {pageItems.map((f) => {
                                                const createdAt = f.createdAt?.toDate?.() || null;
                                                const createdStr = createdAt
                                                    ? `${createdAt.toLocaleDateString()} (${timeAgo(createdAt)})`
                                                    : "—";

                                                const status = statusLabel(f);
                                                const statusDot =
                                                    f.status === "analyzed"
                                                        ? "history-status-dot--ok"
                                                        : f.status === "failed"
                                                          ? "history-status-dot--fail"
                                                          : "history-status-dot--progress";
                                                const statusIcon =
                                                    f.status === "analyzed" ? (
                                                        <MdCheck size={14} />
                                                    ) : f.status === "failed" ? (
                                                        <MdClose size={14} />
                                                    ) : (
                                                        <MdHourglassEmpty size={14} />
                                                    );

                                                return (
                                                    <tr key={f.fileId}>
                                                        <td>
                                                            <div className="history-filecell">
                                                                <FileThumb f={f} />
                                                                <div style={{ minWidth: 0 }}>
                                                                    <div className="history-filename" title={f.name}>
                                                                        {f.name}
                                                                    </div>
                                                                    <div className="history-meta">
                                                                        {(f.contentType || "").toUpperCase()}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td>{createdStr}</td>
                                                        <td>
                                                            <span className="history-tag">{categoryLabel(f)}</span>
                                                        </td>
                                                        <td>
                                                            <span className="history-status">
                                                                <span className={`history-status-dot ${statusDot}`}>
                                                                    {statusIcon}
                                                                </span>
                                                                {status}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <div className="history-actions">
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-primary"
                                                                    onClick={() =>
                                                                        router.push(
                                                                            `/documents?fileId=${encodeURIComponent(f.fileId)}`,
                                                                        )
                                                                    }>
                                                                    View
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="history-pagination">
                                    <div className="history-pageinfo">
                                        Showing {(currentPage - 1) * pageSize + 1}–
                                        {Math.min(currentPage * pageSize, files.length)} of {files.length}
                                    </div>
                                    <div className="history-pagebuttons">
                                        <button
                                            type="button"
                                            className="history-pagebtn"
                                            disabled={currentPage <= 1}
                                            onClick={() => setPage((p) => Math.max(1, p - 1))}>
                                            Prev
                                        </button>
                                        {Array.from({ length: totalPages })
                                            .slice(0, 7)
                                            .map((_, idx) => {
                                                const p = idx + 1;
                                                return (
                                                    <button
                                                        key={p}
                                                        type="button"
                                                        className={`history-pagebtn ${p === currentPage ? "history-pagebtn--active" : ""}`}
                                                        onClick={() => setPage(p)}>
                                                        {p}
                                                    </button>
                                                );
                                            })}
                                        <button
                                            type="button"
                                            className="history-pagebtn"
                                            disabled={currentPage >= totalPages}
                                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                                            Next
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </section>
                </div>
            </main>
        </div>
    );
}
