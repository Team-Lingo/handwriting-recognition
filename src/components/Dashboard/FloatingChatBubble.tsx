"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MdAutoAwesome } from "react-icons/md";
import "./FloatingChatBubble.css";

export default function FloatingChatBubble() {
    const pathname = usePathname();

    if (pathname?.startsWith("/ai-chat") || pathname?.startsWith("/auth")) {
        return null;
    }

    return (
        <Link
            href="/ai-chat"
            className="floating-chat-bubble"
            aria-label="Open AI chat assistant"
            title="Ask the AI assistant">
            <MdAutoAwesome aria-hidden="true" />
        </Link>
    );
}
