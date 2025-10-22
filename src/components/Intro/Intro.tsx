"use client";
import Image from "next/image";
import { SquareCheckBig } from "lucide-react";
import "./Intro.css";

const FEATURES = [
  {
    title: "Instant Recognition",
    description: "Upload and get results in seconds",
  },
  {
    title: "Multiple Formats",
    description: "Export as PDF, Word, or plain text",
  },
  {
    title: "Language Enhancement",
    description: "AI-powered grammar and style improvements",
  },
];

export default function IntroSection() {
  return (
    <section className="section">
      <div className="container intro-container">
        <div className="intro-content">
          <h2 className="intro-title">Transform Handwriting in Seconds</h2>
          <p className="intro-description">
            Simply upload your handwritten notes, documents, or manuscripts. Our
            AI instantly recognizes the text and enhances the language quality.
          </p>
          <ul className="intro-features">
            {FEATURES.map((feature, index) => (
              <li key={index} className="intro-feature">
                <div className="feature-icon">
                  <SquareCheckBig size={24} strokeWidth={2} />
                </div>
                <div className="feature-text">
                  <h3 className="feature-title">{feature.title}</h3>
                  <p className="feature-description">{feature.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="intro-image">
          <Image
            src="/Images/feature-1.png"
            alt="Person writing in a notebook"
            width={640}
            height={640}
            quality={100}
            priority
          />
        </div>
      </div>
    </section>
  );
}
