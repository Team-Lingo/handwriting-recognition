"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
    MdDashboard,
    MdDescription,
    MdLanguage,
    MdAutoAwesome,
    MdHistory,
    MdEmail,
    MdHelp,
    MdSettings,
    MdExpandMore,
    MdExpandLess,
    MdLogout,
} from "react-icons/md";
import { User } from "firebase/auth";
import { UserProfile } from "@/types/profile";
import { useAuth } from "@/contexts/AuthContext";
import "./DashboardSidebar.css";

interface DashboardSidebarProps {
    user?: User | null;
    userProfile?: UserProfile | null;
}

interface SidebarItem {
    id: string;
    label: string;
    icon: React.ReactNode;
    href: string;
}

const sidebarItems: SidebarItem[] = [
    { id: "dashboard", label: "Dashboard", icon: <MdDashboard />, href: "/dashboard-new" },
    { id: "documents", label: "Documents", icon: <MdDescription />, href: "/dashboard-new?tab=documents" },
    { id: "language", label: "Language Detection", icon: <MdLanguage />, href: "/dashboard-new?tab=language" },
    { id: "ai", label: "AI Analysis", icon: <MdAutoAwesome />, href: "/dashboard-new?tab=ai" },
    { id: "history", label: "History", icon: <MdHistory />, href: "/files" },
];

const bottomItems: SidebarItem[] = [
    { id: "contact", label: "Contact", icon: <MdEmail />, href: "/contact" },
    { id: "help", label: "Help", icon: <MdHelp />, href: "/dashboard-new?tab=help" },
    { id: "settings", label: "Settings", icon: <MdSettings />, href: "/profile" },
];

export default function DashboardSidebar({ user, userProfile }: DashboardSidebarProps) {
    const { signOut } = useAuth();
    const [activeId, setActiveId] = useState("dashboard");
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const handleLogout = async () => {
        try {
            await signOut();
        } catch (error) {
            console.error("Error signing out:", error);
        }
    };

    // Get user initials for avatar
    const getInitials = () => {
        if (userProfile?.firstName && userProfile?.lastName) {
            return `${userProfile.firstName[0]}${userProfile.lastName[0]}`.toUpperCase();
        }
        if (user?.email) {
            return user.email.substring(0, 2).toUpperCase();
        }
        return "U";
    };

    const displayName =
        userProfile?.firstName && userProfile?.lastName
            ? `${userProfile.firstName} ${userProfile.lastName}`
            : user?.displayName || "User";

    const displayEmail = user?.email || "";

    return (
        <aside className="dashboard-sidebar">
            <div className="sidebar-header">
                <div className="sidebar-logo">
                    <Image src="/images/Logo.png" alt="Lingo Logo" width={32} height={32} className="logo-icon" />
                </div>
            </div>

            <nav className="sidebar-nav">
                <div className="sidebar-section">
                    {sidebarItems.map((item) => (
                        <Link
                            key={item.id}
                            href={item.href}
                            className={`sidebar-item ${activeId === item.id ? "active" : ""}`}
                            onClick={() => setActiveId(item.id)}>
                            <span className="sidebar-icon">{item.icon}</span>
                            <span className="sidebar-label">{item.label}</span>
                        </Link>
                    ))}
                </div>
            </nav>

            <div className="sidebar-footer">
                <div className={`sidebar-bottom-menu ${isMenuOpen ? "open" : ""}`}>
                    {bottomItems.map((item, index) => (
                        <Link
                            key={item.id}
                            href={item.href}
                            className={`sidebar-item ${activeId === item.id ? "active" : ""}`}
                            onClick={() => setActiveId(item.id)}
                            style={{ animationDelay: `${index * 50}ms` }}>
                            <span className="sidebar-icon">{item.icon}</span>
                            <span className="sidebar-label">{item.label}</span>
                        </Link>
                    ))}
                    <button
                        className="sidebar-item logout-item"
                        onClick={handleLogout}
                        style={{ animationDelay: `${bottomItems.length * 50}ms` }}>
                        <span className="sidebar-icon">
                            <MdLogout />
                        </span>
                        <span className="sidebar-label">Log Out</span>
                    </button>
                </div>
                <button className="sidebar-user" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                    <div className="user-avatar">
                        {userProfile?.profilePictureUrl ? (
                            <Image
                                src={userProfile.profilePictureUrl}
                                alt="Profile"
                                width={40}
                                height={40}
                                className="user-avatar-img"
                            />
                        ) : (
                            getInitials()
                        )}
                    </div>
                    <div className="user-info">
                        <div className="user-name">{displayName}</div>
                        <div className="user-email">{displayEmail}</div>
                    </div>
                    <span className="user-menu-btn">{isMenuOpen ? <MdExpandMore /> : <MdExpandLess />}</span>
                </button>
            </div>
        </aside>
    );
}
