import { Suspense } from "react";

import "../dashboard/dashboard.css";
import "./ai-chat.css";

import AiChatClient from "./AiChatClient";

export default function AiChatPage() {
    return (
        <Suspense fallback={<div className="loading-container">Loading…</div>}>
            <AiChatClient />
        </Suspense>
    );
}
