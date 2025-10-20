"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
          <Link href="/register" className="btn-primary-rounded">
            Get Started
          </Link>
        </div>
      </nav>
    </header>
  );
}
