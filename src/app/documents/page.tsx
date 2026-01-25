import { Suspense } from "react";

import "../dashboard/dashboard.css";
import "./documents.css";

import DocumentsClient from "./DocumentsClient";

export default function DocumentsPage() {
    return (
        <Suspense fallback={<div className="loading-container">Loading...</div>}>
            <DocumentsClient />
        </Suspense>
    );
}
