"use client";
import { useState } from "react";
import { MdImage, MdSlideshow, MdPictureAsPdf, MdCloudUpload } from "react-icons/md";
import "./QuickRecognition.css";

export default function QuickRecognition() {
    const [selectedFormat, setSelectedFormat] = useState<"image" | "powerpoint" | "pdf">("image");
    const [recognizedText] = useState("");

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            console.log("File selected:", file.name);
            // TODO: Implement actual file upload and OCR processing
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
                            accept={
                                selectedFormat === "image"
                                    ? "image/jpeg,image/png"
                                    : selectedFormat === "pdf"
                                    ? "application/pdf"
                                    : ".ppt,.pptx"
                            }
                            onChange={handleFileUpload}
                        />
                        <label htmlFor="file-upload" className="upload-label">
                            <div className="upload-icon">
                                <MdCloudUpload />
                            </div>
                            <p className="upload-text">Drop your image here or click to browse</p>
                            <p className="upload-subtext">Supported formats - JPG, PNG</p>
                        </label>
                    </div>
                </div>

                <div className="recognition-output">
                    <div className="output-content">
                        {recognizedText ? (
                            <div className="recognized-text">{recognizedText}</div>
                        ) : (
                            <p className="output-placeholder">Upload an image to see the converted text here</p>
                        )}
                    </div>
                    <button className="recognize-btn">Recognize text</button>
                </div>
            </div>
        </div>
    );
}
