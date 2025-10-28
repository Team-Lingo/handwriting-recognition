"use client";
import "./DashboardHeader.css";

interface DashboardHeaderProps {
    userName?: string;
}

export default function DashboardHeader({ userName = "Abdelrahman" }: DashboardHeaderProps) {
    return (
        <header className="dashboard-page-header">
            <div className="header-content">
                <h1 className="header-title">Welcome to Lingo, {userName}!</h1>
            </div>
        </header>
    );
}
