"use client";
import { MdDescription } from "react-icons/md";
import "./DocumentCard.css";

interface DocumentCardProps {
    title: string;
    language: string;
    timeAgo: string;
    icon?: React.ReactNode;
}

export default function DocumentCard({ title, language, timeAgo, icon = <MdDescription /> }: DocumentCardProps) {
    return (
        <div className="document-card">
            <div className="document-icon-wrapper">
                <span className="document-icon">{icon}</span>
            </div>
            <div className="document-info">
                <h4 className="document-title">{title}</h4>
                <div className="document-meta">
                    <span className="document-language">{language}</span>
                    <span className="document-separator">•</span>
                    <span className="document-time">{timeAgo}</span>
                </div>
            </div>
        </div>
    );
}
