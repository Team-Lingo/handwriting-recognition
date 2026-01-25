import { Suspense } from "react";

import "../dashboard/dashboard.css";
import "./language-detection.css";

import LanguageDetectionClient from "./LanguageDetectionClient";

export default function LanguageDetectionPage() {
    return (
        <Suspense fallback={<div className="loading-container">Loading...</div>}>
            <LanguageDetectionClient />
        </Suspense>
    );
}
