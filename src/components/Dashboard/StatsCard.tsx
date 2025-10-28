"use client";
import "./StatsCard.css";

interface StatsCardProps {
    title: string;
    value: string | number;
    change?: string;
    changeType?: "positive" | "negative" | "neutral";
    icon: React.ReactNode;
}

export default function StatsCard({ title, value, change, changeType = "neutral", icon }: StatsCardProps) {
    return (
        <div className="stats-card">
            <div className="stats-icon-wrapper">
                <span className="stats-icon">{icon}</span>
            </div>
            <div className="stats-content">
                <div className="stats-header">
                    <h3 className="stats-title">{title}</h3>
                    {change && <span className={`stats-change stats-change-${changeType}`}>{change}</span>}
                </div>
                <p className="stats-value">{value}</p>
            </div>
        </div>
    );
}
