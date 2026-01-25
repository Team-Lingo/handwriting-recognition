"use client";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
    MdCheckCircle,
    MdDescription,
    MdImage,
    MdLanguage,
    MdPictureAsPdf,
    MdSlideshow,
    MdTrendingUp,
} from "react-icons/md";
import DashboardSidebar from "@/components/Dashboard/DashboardSidebar";
import DashboardHeader from "@/components/Dashboard/DashboardHeader";
import StatsCard from "@/components/Dashboard/StatsCard";
import DocumentCard from "@/components/Dashboard/DocumentCard";
import QuickRecognition from "@/components/Dashboard/QuickRecognition";
import { getUserFilesCount, listUserFiles } from "@/services/filesService";
import type { UserFileRecord } from "@/types/file";
import "./dashboard.css";

function startOfTodayLocal(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
}

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

function iconForFile(f: UserFileRecord) {
    const ct = (f.contentType || "").toLowerCase();
    if (ct.startsWith("image/")) return <MdImage />;
    if (ct === "application/pdf") return <MdPictureAsPdf />;
    if (ct.includes("presentation") || f.name.toLowerCase().endsWith(".pptx")) return <MdSlideshow />;
    return <MdDescription />;
}

export default function DashboardPage() {
    const { user, userProfile, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    const [totalDocs, setTotalDocs] = useState<number>(0);
    const [recentFiles, setRecentFiles] = useState<UserFileRecord[]>([]);
    const [scanFiles, setScanFiles] = useState<UserFileRecord[]>([]);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!loading && !user) {
            router.push(`/auth?next=${encodeURIComponent(pathname || "/dashboard")}`);
        }
    }, [user, loading, router, pathname]);

    useEffect(() => {
        const load = async () => {
            if (!user) return;
            setBusy(true);
            try {
                const [count, recent, scan] = await Promise.all([
                    getUserFilesCount(user.uid),
                    listUserFiles(user.uid, 4),
                    listUserFiles(user.uid, 200),
                ]);
                setTotalDocs(count);
                setRecentFiles(recent);
                setScanFiles(scan);
            } finally {
                setBusy(false);
            }
        };
        void load();
    }, [user]);

    const stats = useMemo(() => {
        const languages = new Set<string>();
        const todayStart = startOfTodayLocal().getTime();
        let processedToday = 0;

        const accuracies: number[] = [];

        for (const f of scanFiles) {
            const lang = f.ocr?.language;
            if (lang) languages.add(lang);

            const analyzedAt = f.analyzedAt?.toDate?.()?.getTime?.() ?? null;
            if (analyzedAt && analyzedAt >= todayStart) processedToday += 1;

            const acc = f.ocr?.accuracy;
            if (typeof acc === "number" && Number.isFinite(acc)) accuracies.push(acc);
        }

        const avgAccuracy = accuracies.length > 0 ? accuracies.reduce((a, b) => a + b, 0) / accuracies.length : null;

        const storedLanguages = userProfile?.ocrStats?.languages;
        const storedLanguagesDetected = storedLanguages ? Object.keys(storedLanguages).length : null;
        const storedAvgAccuracy = userProfile?.ocrStats?.avgAccuracy ?? null;

        return {
            languagesDetected: storedLanguagesDetected ?? languages.size,
            processedToday,
            avgAccuracy: storedAvgAccuracy ?? avgAccuracy,
        };
    }, [scanFiles, userProfile?.ocrStats?.avgAccuracy, userProfile?.ocrStats?.languages]);

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

                    <div className="stats-grid">
                        <StatsCard icon={<MdDescription />} title="Total Documents" value={busy ? "…" : totalDocs} />
                        <StatsCard
                            icon={<MdLanguage />}
                            title="Languages Detected"
                            value={busy ? "…" : stats.languagesDetected}
                        />
                        <StatsCard
                            icon={<MdCheckCircle />}
                            title="Processed Today"
                            value={busy ? "…" : stats.processedToday}
                        />
                        <StatsCard
                            icon={<MdTrendingUp />}
                            title="Accuracy Rate"
                            value={busy ? "…" : stats.avgAccuracy !== null ? `${stats.avgAccuracy.toFixed(1)}%` : "—"}
                        />
                    </div>

                    <section className="dashboard-section">
                        <div
                            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                            <h2 className="section-title">Recent documents</h2>
                        </div>

                        <div className="documents-grid">
                            {recentFiles.length === 0 ? (
                                <div style={{ color: "var(--Secondary-Text)", padding: 8 }}>
                                    No documents yet. Upload something in Quick Text Recognition to get started.
                                </div>
                            ) : (
                                recentFiles.map((f) => {
                                    const createdAt = f.createdAt?.toDate?.() || null;
                                    return (
                                        <div
                                            key={f.fileId}
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => router.push("/history")}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" || e.key === " ") router.push("/history");
                                            }}
                                            style={{ cursor: "pointer" }}>
                                            <DocumentCard
                                                title={f.name}
                                                language={f.ocr?.language || "—"}
                                                timeAgo={createdAt ? timeAgo(createdAt) : ""}
                                                icon={iconForFile(f)}
                                            />
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </section>

                    <section className="dashboard-section">
                        <QuickRecognition />
                    </section>
                </div>
            </main>
        </div>
    );
}
