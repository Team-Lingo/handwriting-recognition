"use client";
import { useEffect, useMemo, useState } from "react";
import { MdImage, MdSlideshow, MdPictureAsPdf, MdCloudUpload } from "react-icons/md";
import { useRouter } from "next/navigation";
import { ref, uploadBytes } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { setUserFileFailed, setUserFileOcrResult, upsertUserFileRecord } from "@/services/filesService";
import type { OcrResponse } from "@/types/ocr";
import "./QuickRecognition.css";

export default function QuickRecognition() {
    const { user, refreshUserProfile } = useAuth();
    const router = useRouter();
    const [selectedFormat, setSelectedFormat] = useState<"image" | "powerpoint" | "pdf">("image");
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [recognizedText, setRecognizedText] = useState("");
    const [recognizedMeta, setRecognizedMeta] = useState<Pick<
        OcrResponse,
        "language" | "accuracy" | "correctedText"
    > | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastFileId, setLastFileId] = useState<string | null>(null);

    const supportedText =
        selectedFormat === "image"
            ? "Supported formats - JPG, PNG"
            : selectedFormat === "pdf"
              ? "Supported formats - PDF"
              : "Supported formats - PPTX";

    const accept =
        selectedFormat === "image" ? "image/jpeg,image/png" : selectedFormat === "pdf" ? "application/pdf" : ".pptx";

    const uploadText =
        selectedFormat === "image"
            ? "Drop your image here or click to browse"
            : selectedFormat === "pdf"
              ? "Drop your PDF here or click to browse"
              : "Drop your PPTX here or click to browse";

    useEffect(() => {
        if (!selectedFile) {
            setPreviewUrl(null);
            return;
        }

        if (!selectedFile.type.startsWith("image/")) {
            setPreviewUrl(null);
            return;
        }

        const url = URL.createObjectURL(selectedFile);
        setPreviewUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [selectedFile]);

    const fileDetails = useMemo(() => {
        if (!selectedFile) return null;
        const sizeKb = Math.round(((selectedFile.size || 0) / 1024) * 10) / 10;
        return {
            name: selectedFile.name,
            contentType: selectedFile.type || "—",
            sizeLabel: Number.isFinite(sizeKb) ? `${sizeKb} KB` : "—",
        };
    }, [selectedFile]);

    const createFileId = () =>
        globalThis.crypto && "randomUUID" in globalThis.crypto
            ? globalThis.crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const runRecognition = async (file: File) => {
        if (!user) {
            setError("Please sign in to recognize and save documents.");
            return;
        }

        setBusy(true);
        setError(null);
        setRecognizedText("");
        setRecognizedMeta(null);

        const fileId = lastFileId || createFileId();
        setLastFileId(fileId);

        const ext = file.name.includes(".") ? `.${file.name.split(".").pop()}` : "";
        const storagePath = `users/${user.uid}/files/${fileId}${ext}`;

        try {
            // Upload to Storage so it appears in History and can be re-opened later.
            const storageRef = ref(storage, storagePath);
            await uploadBytes(storageRef, file, {
                contentType: file.type,
                customMetadata: { originalName: file.name },
            });

            // Ensure Firestore record exists immediately (cloud function may also merge).
            await upsertUserFileRecord(user.uid, fileId, {
                name: file.name,
                storagePath,
                bucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
                contentType: file.type || null,
                size: file.size,
                status: "uploaded",
            });

            // OCR
            const formData = new FormData();
            formData.append("file", file);
            const res = await fetch("/api/ocr", { method: "POST", body: formData });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body?.error || "OCR failed");
            }

            const data: OcrResponse = await res.json();
            setRecognizedText(data.correctedText || data.text || "");
            setRecognizedMeta({
                language: data.language,
                accuracy: data.accuracy,
                correctedText: data.correctedText,
            });

            await setUserFileOcrResult(user.uid, fileId, data);
            await refreshUserProfile();
        } catch (e) {
            const message = (e as Error).message || "Failed to recognize text";
            setError(message);
            if (user && fileId) {
                try {
                    await setUserFileFailed(user.uid, fileId, message);
                } catch {
                    // ignore
                }
            }
        } finally {
            setBusy(false);
        }
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            setLastFileId(null);
            void runRecognition(file);
        }
    };

    return (
        <div className="quick-recognition">
            <h2 className="quick-recognition-title">Quick Text Recognition</h2>

            <div className="recognition-container">
                <div className="recognition-input">
                    <div className="format-selector">
                        <button
                            className={`format-btn ${selectedFormat === "image" ? "active" : ""}`}
                            onClick={() => setSelectedFormat("image")}>
                            <MdImage /> Image
                        </button>
                        <button
                            className={`format-btn ${selectedFormat === "powerpoint" ? "active" : ""}`}
                            onClick={() => setSelectedFormat("powerpoint")}>
                            <MdSlideshow /> PowerPoint
                        </button>
                        <button
                            className={`format-btn ${selectedFormat === "pdf" ? "active" : ""}`}
                            onClick={() => setSelectedFormat("pdf")}>
                            <MdPictureAsPdf /> PDF
                        </button>
                    </div>

                    <div className="upload-area">
                        <input
                            type="file"
                            id="file-upload"
                            className="file-input"
                            accept={accept}
                            onChange={handleFileUpload}
                        />
                        <label htmlFor="file-upload" className="upload-label">
                            <div className="upload-preview-wrapper">
                                {previewUrl ? (
                                    <img src={previewUrl} alt="Selected" className="upload-preview" />
                                ) : (
                                    <div className="upload-icon">
                                        <MdCloudUpload />
                                    </div>
                                )}
                            </div>
                            <p className="upload-text">{uploadText}</p>
                            <p className="upload-subtext">{supportedText}</p>
                        </label>
                    </div>
                </div>

                <div className="recognition-output">
                    <div className="output-content">
                        {busy ? (
                            <p className="output-placeholder">Recognizing…</p>
                        ) : error ? (
                            <p className="output-placeholder">{error}</p>
                        ) : recognizedText || selectedFile ? (
                            <div className="recognized-text">
                                <div className="qr-details">
                                    <div className="qr-detail-row">
                                        <span className="qr-detail-label">File</span>
                                        <span className="qr-detail-value">{fileDetails?.name || "—"}</span>
                                    </div>
                                    <div className="qr-detail-row">
                                        <span className="qr-detail-label">Type</span>
                                        <span className="qr-detail-value">{fileDetails?.contentType || "—"}</span>
                                    </div>
                                    <div className="qr-detail-row">
                                        <span className="qr-detail-label">Size</span>
                                        <span className="qr-detail-value">{fileDetails?.sizeLabel || "—"}</span>
                                    </div>
                                    <div className="qr-detail-row">
                                        <span className="qr-detail-label">Language</span>
                                        <span className="qr-detail-value">{recognizedMeta?.language || "—"}</span>
                                    </div>
                                    <div className="qr-detail-row">
                                        <span className="qr-detail-label">Accuracy</span>
                                        <span className="qr-detail-value">
                                            {typeof recognizedMeta?.accuracy === "number"
                                                ? `${recognizedMeta.accuracy}%`
                                                : "—"}
                                        </span>
                                    </div>
                                </div>

                                {recognizedText ? (
                                    <div className="qr-text-preview">{recognizedText}</div>
                                ) : (
                                    <div className="qr-text-preview qr-text-preview--empty">
                                        Upload a file to run recognition.
                                    </div>
                                )}
                            </div>
                        ) : (
                            <p className="output-placeholder">Upload a file to see the converted text here</p>
                        )}
                    </div>
                    <button
                        className="recognize-btn"
                        disabled={!selectedFile || busy || !user}
                        onClick={() => {
                            if (busy) return;
                            if (recognizedText && lastFileId) {
                                router.push(`/documents?fileId=${encodeURIComponent(lastFileId)}`);
                                return;
                            }
                            if (selectedFile) void runRecognition(selectedFile);
                        }}>
                        {busy ? "Recognizing…" : recognizedText && lastFileId ? "Discover more" : "Recognize text"}
                    </button>
                </div>
            </div>
        </div>
    );
}
