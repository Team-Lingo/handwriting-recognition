"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { MdDescription, MdLanguage, MdCheckCircle, MdTrendingUp, MdImage } from "react-icons/md";
import DashboardSidebar from "@/components/Dashboard/DashboardSidebar";
import DashboardHeader from "@/components/Dashboard/DashboardHeader";
import StatsCard from "@/components/Dashboard/StatsCard";
import DocumentCard from "@/components/Dashboard/DocumentCard";
import QuickRecognition from "@/components/Dashboard/QuickRecognition";
import "./dashboard.css";

export default function DashboardNewPage() {
    const { user, userProfile, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !user) {
            router.push("/login");
        }
    }, [user, loading, router]);

    if (loading) {
        return (
            <div className="dashboard-layout">
                <DashboardSidebar user={user} userProfile={userProfile} />
                <main className="dashboard-main">
                    <div className="loading-container">Loading...</div>
                </main>
            </div>
        );
    }

    if (!user) {
        return null;
    }

    const firstName = userProfile?.firstName || "User";

    return (
        <div className="dashboard-layout">
            <DashboardSidebar user={user} userProfile={userProfile} />
            <main className="dashboard-main">
                <div className="dashboard-content">
                    <DashboardHeader userName={firstName} />

                    {/* Stats Grid */}
                    <div className="stats-grid">
                        <StatsCard
                            icon={<MdDescription />}
                            title="Total Documents"
                            value="156"
                            change="+12%"
                            changeType="positive"
                        />
                        <StatsCard
                            icon={<MdLanguage />}
                            title="Languages Detected"
                            value="8"
                            change="+2"
                            changeType="positive"
                        />
                        <StatsCard
                            icon={<MdCheckCircle />}
                            title="Processed Today"
                            value="24"
                            change="+8%"
                            changeType="positive"
                        />
                        <StatsCard
                            icon={<MdTrendingUp />}
                            title="Accuracy Rate"
                            value="98.5%"
                            change="+0.5%"
                            changeType="positive"
                        />
                    </div>

                    {/* Recent Documents */}
                    <section className="dashboard-section">
                        <h2 className="section-title">Recent documents</h2>
                        <div className="documents-grid">
                            <DocumentCard
                                title="Research Notes.pdf"
                                language="English"
                                timeAgo="2 hours ago"
                                icon={<MdDescription />}
                            />
                            <DocumentCard
                                title="Lecture Summary.jpg"
                                language="Arabic"
                                timeAgo="5 hours ago"
                                icon={<MdImage />}
                            />
                            <DocumentCard
                                title="Meeting Notes.png"
                                language="English"
                                timeAgo="1 day ago"
                                icon={<MdImage />}
                            />
                            <DocumentCard
                                title="Study Guide.pdf"
                                language="French"
                                timeAgo="3 days ago"
                                icon={<MdDescription />}
                            />
                        </div>
                    </section>

                    {/* Quick Text Recognition */}
                    <section className="dashboard-section">
                        <QuickRecognition />
                    </section>
                </div>
            </main>
        </div>
    );
}
