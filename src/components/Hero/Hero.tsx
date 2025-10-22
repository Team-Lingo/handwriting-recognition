"use client";
import Link from "next/link";
import {
  PiPenNibLight,
  PiBookOpenTextLight,
  PiClipboardTextLight,
  PiNotebookLight,
  PiFeatherLight,
  PiFileTextLight,
} from "react-icons/pi";
import "./Hero.css";
import { Sparkles } from "lucide-react";

export default function Hero() {
  return (
    <section className="section hero">
      <div className="hero-icons">
        <PiBookOpenTextLight className="hero-icon icon-1" />
        <PiPenNibLight className="hero-icon icon-2" />
        <PiClipboardTextLight className="hero-icon icon-3" />
        <PiNotebookLight className="hero-icon icon-4" />
        <PiFeatherLight className="hero-icon icon-5" />
        <PiFileTextLight className="hero-icon icon-6" />
      </div>

      <div className="container">
        <span className="hero-badge">
            <Sparkles />
          AI-Powered Recognition
        </span>

        <h1 className="hero-title">
          Unlock the past with <span className="hero-highlight">Lingo</span>
        </h1>

        <p className="hero-subtitle">
          Advanced AI technology that recognizes handwriting and enhances
          language quality. Perfect for students, researchers, and
          professionals.
        </p>

        <div className="hero-buttons">
          <Link href="/features" className="btn-secondary-outline">
            See features
          </Link>
          <Link href="/register" className="btn-primary-solid">
            Try for free
          </Link>
        </div>
      </div>

      <svg
        className="hero-wave"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1440 320"
        preserveAspectRatio="none"
      >
        <path
          fill="var(--Primary-Dark)"
          fillOpacity="1"
          d="M0,96L48,112C96,128,192,160,288,165.3C384,171,480,149,576,133.3C672,117,768,107,864,122.7C960,139,1056,181,1152,197.3C1248,213,1344,203,1392,197.3L1440,192L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
        ></path>
      </svg>
    </section>
  );
}
