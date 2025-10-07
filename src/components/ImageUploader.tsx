"use client";
import React, { useState } from "react";
import { OcrResponse } from "@/types/ocr";

interface Props {
    onResult: (res: OcrResponse) => void;
}

export default function ImageUploader({ onResult }: Props) {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (f) {
            setFile(f);
            setPreview(URL.createObjectURL(f));
        }
    };

    const upload = async () => {
        if (!file) return;
        setLoading(true);
        const body = new FormData();
        body.append("file", file);
        const res = await fetch("/api/ocr", { method: "POST", body });
        const data: OcrResponse = await res.json();
        onResult(data);
        setLoading(false);
    };

    return (
        <div className="card" style={{ textAlign: "center" }}>
            <input type="file" accept="image/*" onChange={handleSelect} />
            {preview && (
                <img
                    src={preview}
                    alt="preview"
                    style={{ margin: "1rem auto", maxHeight: "220px", objectFit: "contain" }}
                />
            )}
            <button className="btn" disabled={!file || loading} onClick={upload}>
                {loading ? "Processing…" : "Analyze"}
            </button>
        </div>
    );
}
