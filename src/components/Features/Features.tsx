"use client";
import Image from "next/image";
import {  SquareCheckBig } from "lucide-react";
import "./Features.css";

type Feature = {
  title: string;
  description: string;
  bullets: string[];
  image: string;
};

const FEATURES: Feature[] = [
  {
    title: "For Teachers and Professors",
    description:
      "Grade papers and assignments faster by converting handwritten work into digital format.",
    bullets: [
      "Grade from anywhere on any device",
      "Capture work exactly as submitted",
      "Compare submissions easily",
    ],
    image: "/Images/Collaborative Brainstorming.png",
  },
  {
    title: "For Historical Researchers",
    description:
      "Transform historical documents into searchable records for research and preservation.",
    bullets: [
      "Convert old handwriting accurately",
      "Support for multiple languages and scripts",
      "Preserve original document structure",
    ],
    image: "/Images/Rustic Desk with Open Book.png",
  },
  {
    title: "For Personal Writing & Journaling",
    description:
      "Turn your personal writings into searchable digital text while keeping their authentic feel.",
    bullets: [
      "Preserve layout and character",
      "Access personal archives from any device",
      "Import from note‑taking apps",
    ],
    image: "/Images/Writing in Notebook.png",
  },
  {
    title: "For Business Operations",
    description:
      "Digitize forms, invoices, and customer records with enterprise‑grade accuracy and security.",
    bullets: [
      "Process thousands of documents in seconds",
      "Extract data directly into your systems",
      "Save hours on manual data entry",
    ],
    image: "/Images/timesheet-CxrfxUJ3.webp",
  },
];

export default function Features() {
  return (
    <section
      className="section features-section"
      aria-labelledby="features-heading"
    >
      <div className="container">
        <div className="features-grid">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className={`feature-row ${i % 2 === 1 ? "reverse" : ""}`}
            >
              <div className="feature-text">
                <h3 className="feature-title">{f.title}</h3>
                <p className="feature-description">{f.description}</p>
                <ul className="feature-list">
                  {f.bullets.map((b, idx) => (
                    <li key={idx} className="feature-item">
                      <SquareCheckBig size={16} className="feature-check" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="feature-image">
                <Image
                  src={f.image}
                  alt={f.title}
                  fill
                  sizes="(max-width: 960px) 100vw, 560px"
                  quality={100}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
