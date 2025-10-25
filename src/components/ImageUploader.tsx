"use client";
import React, { useState } from "react";
import { ref, uploadBytes } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";

export default function ImageUploader() {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const { user } = useAuth();

    const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (f) {
            setFile(f);
            setPreview(URL.createObjectURL(f));
        }
    };

    const upload = async () => {
        if (!file || !user) return;
        setLoading(true);
        setMessage(null);
        try {
            const ext = file.name.includes(".") ? `.${file.name.split(".").pop()}` : "";
            const fileId =
                globalThis.crypto && "randomUUID" in globalThis.crypto
                    ? globalThis.crypto.randomUUID()
                    : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const fullPath = `users/${user.uid}/files/${fileId}${ext}`;
            const storageRef = ref(storage, fullPath);
            await uploadBytes(storageRef, file, {
                contentType: file.type,
                customMetadata: {
                    originalName: file.name,
                },
            });
            setMessage("Uploaded successfully!");
            // Reset selection
            setFile(null);
            setPreview(null);
        } catch (err) {
            console.error("Upload failed", err);
            setMessage("Upload failed. Please try again.");
        } finally {
            setLoading(false);
        }
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
            <button className="btn" disabled={!file || loading || !user} onClick={upload}>
                {loading ? "Uploading…" : "Upload"}
            </button>
            {message && (
                <p style={{ marginTop: "0.5rem" }}>
                    {message}{" "}
                    {message.includes("success") && (
                        <a href="/files" style={{ color: "#0070f3", textDecoration: "underline" }}>
                            Click here to view it in files
                        </a>
                    )}
                </p>
            )}
        </div>
    );
}
