"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import "./Navbar.css";

const LINKS = [
    { href: "/", label: "Home" },
    { href: "/features", label: "Features" },
    { href: "/Help", label: "Help" },
    { href: "/contact", label: "Contact" },
];

export default function Navbar() {
    const pathname = usePathname();
    const { user } = useAuth();
    const [menuOpen, setMenuOpen] = useState(false);

    const closeMenu = () => setMenuOpen(false);

    return (
        <header className="nav-wrap">
            <nav className={`nav${menuOpen ? " nav--open" : ""}`}>
                <div className="nav-top">
                    <Link href="/" className="brand" aria-label="Lingo Home" onClick={closeMenu}>
                        <Image src="/Images/Logo.png" alt="LINGO logo" width={48} height={48} />
                    </Link>

                    <button
                        className="nav-toggle"
                        aria-label={menuOpen ? "Close menu" : "Open menu"}
                        aria-expanded={menuOpen}
                        onClick={() => setMenuOpen((o) => !o)}
                    >
                        <span className="hamburger-line" />
                        <span className="hamburger-line" />
                        <span className="hamburger-line" />
                    </button>
                </div>

                <ul className="nav-links" role="list">
                    {LINKS.map((l) => (
                        <li key={l.href}>
                            <Link
                                href={l.href}
                                className={`nav-link ${pathname === l.href ? "active" : ""}`}
                                onClick={closeMenu}
                            >
                                {l.label}
                            </Link>
                        </li>
                    ))}
                </ul>

                <div className="nav-cta">
                    {user ? (
                        <Link href="/dashboard" className="btn-primary-solid" onClick={closeMenu}>
                            Dashboard
                        </Link>
                    ) : (
                        <Link href="/auth?signup=1" className="btn-primary-solid" onClick={closeMenu}>
                            Get Started
                        </Link>
                    )}
                </div>
            </nav>
        </header>
    );
}
