import { Suspense } from "react";

import "../dashboard/dashboard.css";
import "../language-detection/language-detection.css";
import "../history/history.css";
import "./signature-verification.css";

import SignatureVerificationClient from "./SignatureVerificationClient";

export default function SignatureVerificationPage() {
    return (
        <Suspense fallback={<div className="loading-container">Loading...</div>}>
            <SignatureVerificationClient />
        </Suspense>
    );
}
