"use client";
import { useState } from "react";
import ImageUploader from "@/components/ImageUploader";
import { OcrResponse } from "@/types/ocr";

export default function HomePage() {
    const [result, setResult] = useState<OcrResponse | null>(null);

    return (
        <main className="container">
            <h1 style={{ fontSize: "1.8rem", fontWeight: 700, marginBottom: "1rem", textAlign: "center" }}>
                Handwriting Recognition Prototype
            </h1>

            <ImageUploader onResult={setResult} />

            {result && (
                <div className="card" style={{ marginTop: "1.5rem" }}>
                    <p style={{ fontWeight: 600 }}>Detected language: {result.language}</p>
                    <pre style={{ whiteSpace: "pre-wrap", marginTop: "0.5rem" }}>{result.text}</pre>
                </div>
            )}
        </main>
    );
}
