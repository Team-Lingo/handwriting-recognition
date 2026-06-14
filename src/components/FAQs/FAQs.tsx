"use client";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import "./FAQs.css";

const FAQS = [
  {
    question: "What is the goal of this project?",
    answer:
      "The project aims to build a system that recognizes handwritten text (OCR) and analyzes handwriting characteristics (e.g., slant, pressure, speed) to extract behavioral and stylistic features. The system combines computer vision and machine learning for both transcription and handwriting analysis.",
  },
  {
    question: "What data do you use?",
    answer:
      "We use publicly available handwriting datasets such as the IAM Handwriting Database and MNIST, supplemented with custom-collected samples to improve model robustness across diverse handwriting styles and languages.",
  },
  {
    question: "Which preprocessing steps are applied?",
    answer:
      "Images undergo noise reduction, binarization, skew correction, and line/word segmentation before being fed into the recognition model. These steps ensure consistent input quality for accurate results.",
  },
  {
    question: "Which features are extracted for handwriting analysis?",
    answer:
      "We extract features such as letter slant angle, stroke width, spacing between characters and words, pen pressure estimation, and writing speed indicators — all contributing to behavioral and stylistic profiling.",
  },
  {
    question: "How do you evaluate the recognition performance?",
    answer:
      "We use Character Error Rate (CER) and Word Error Rate (WER) as primary metrics, benchmarked against standard datasets and validated through cross-validation with held-out test sets.",
  },
  {
    question: "How do you handle multiple languages or scripts?",
    answer:
      "The system supports multiple scripts through language-specific models and Unicode-aware processing pipelines. Currently supported languages include English, Arabic, and French, with more planned.",
  },
];

export default function FAQs() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="section faqs-section">
      <div className="container">
        <div className="faqs-header">
          <h2 className="faqs-title">Frequently Asked Questions</h2>
          <p className="faqs-subtitle">
            Everything you need to know about our handwriting recognition system.
          </p>
        </div>
        <div className="faqs-list">
          {FAQS.map((faq, index) => (
            <div
              key={index}
              className={`faq-item${openIndex === index ? " faq-item--open" : ""}`}
            >
              <button
                className="faq-question"
                onClick={() => toggle(index)}
                aria-expanded={openIndex === index}
              >
                <span>{faq.question}</span>
                <ChevronDown className="faq-icon" size={20} />
              </button>
              <div className="faq-answer">
                <p>{faq.answer}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
