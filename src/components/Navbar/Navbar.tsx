"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import "./Navbar.css";

const LINKS = [
  { href: "/landing", label: "Home" },
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/solutions", label: "Solutions" },
  { href: "/contact", label: "Contact" },
];

export default function Navbar() {
  const pathname = usePathname();
  const { user } = useAuth();
  return (
    <header className="nav-wrap">
      <nav className="nav">
        <Link href="/" className="brand" aria-label="Lingo Home">
          <Image
            src="/Images/Logo.png"
            alt="LINGO logo"
            width={48}
            height={48}
          />
        </Link>
        <ul className="nav-links" role="list">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className={`nav-link ${pathname === l.href ? "active" : ""}`}
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="nav-cta">
          {user ? (
            <div className="flex items-center gap-4">
              <Link href="/profile" className="nav-link flex items-center gap-2">
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  strokeWidth={1.5} 
                  stroke="currentColor" 
                  className="w-6 h-6"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                Profile
              </Link>
              <Link href="/dashboard" className="btn-primary-rounded">
                Dashboard
              </Link>
            </div>
          ) : (
            <Link href="/register" className="btn-primary-rounded">
              Get Started
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
