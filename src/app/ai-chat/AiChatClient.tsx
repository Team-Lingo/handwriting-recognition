"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { MdSend, MdChat, MdAttachFile, MdClose, MdInsertDriveFile } from "react-icons/md";

import DashboardHeader from "@/components/Dashboard/DashboardHeader";
import DashboardSidebar from "@/components/Dashboard/DashboardSidebar";
import { useAuth } from "@/contexts/AuthContext";

interface Attachment {
    id: string;
    name: string;
    type: string;
    dataUrl: string;
    size: number;
}

interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    attachments?: Attachment[];
    timestamp: Date;
}

// ---------------------------------------------------------------------------
// TODO (for your Demiana ): replace this stub with the real AI call.
// messages     — full conversation history
// userMessage  — new user text (may be empty if only files were sent)
// attachments  — files for this message; dataUrl holds base64-encoded content
// ---------------------------------------------------------------------------
async function sendMessageToAI(
    messages: Message[],
    userMessage: string,
    attachments: Attachment[],
): Promise<string> {
    void messages;
    void userMessage;
    void attachments;
    return "AI response coming soon — backend not connected yet.";
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

function createId() {
    return globalThis.crypto && "randomUUID" in globalThis.crypto
        ? globalThis.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatBytes(bytes: number) {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AiChatClient() {
    const { user, userProfile, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [busy, setBusy] = useState(false);
    const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
    const [attachError, setAttachError] = useState<string | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!loading && !user) {
            router.push(`/auth?next=${encodeURIComponent(pathname || "/ai-chat")}`);
        }
    }, [loading, user, router, pathname]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, busy]);

    const firstName = userProfile?.firstName || user?.displayName?.split(" ")[0] || "User";

    const handleFileSelect = (files: FileList | null) => {
        if (!files) return;
        setAttachError(null);

        for (const file of Array.from(files)) {
            if (file.size > MAX_FILE_SIZE) {
                setAttachError(`"${file.name}" exceeds the 10 MB limit.`);
                continue;
            }
            const reader = new FileReader();
            reader.onload = (e) => {
                const dataUrl = e.target?.result as string;
                setPendingAttachments((prev) => [
                    ...prev,
                    { id: createId(), name: file.name, type: file.type, dataUrl, size: file.size },
                ]);
            };
            reader.readAsDataURL(file);
        }

        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const removePendingAttachment = (id: string) => {
        setPendingAttachments((prev) => prev.filter((a) => a.id !== id));
    };

    const handleSend = async () => {
        const text = input.trim();
        if ((!text && pendingAttachments.length === 0) || busy) return;

        const userMsg: Message = {
            id: createId(),
            role: "user",
            content: text,
            attachments: pendingAttachments.length > 0 ? [...pendingAttachments] : undefined,
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMsg]);
        setInput("");
        setPendingAttachments([]);
        setAttachError(null);
        setBusy(true);

        if (textareaRef.current) textareaRef.current.style.height = "auto";

        try {
            const reply = await sendMessageToAI([...messages, userMsg], text, userMsg.attachments ?? []);
            setMessages((prev) => [
                ...prev,
                { id: createId(), role: "assistant", content: reply, timestamp: new Date() },
            ]);
        } catch {
            setMessages((prev) => [
                ...prev,
                {
                    id: createId(),
                    role: "assistant",
                    content: "Something went wrong. Please try again.",
                    timestamp: new Date(),
                },
            ]);
        } finally {
            setBusy(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void handleSend();
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInput(e.target.value);
        e.target.style.height = "auto";
        e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
    };

    if (loading || !user) {
        return (
            <div className="dashboard-layout">
                <DashboardSidebar user={user} userProfile={userProfile} />
                <main className="dashboard-main">
                    <div className="loading-container">Loading…</div>
                </main>
            </div>
        );
    }

    return (
        <div className="dashboard-layout">
            <DashboardSidebar user={user} userProfile={userProfile} />
            <main className="dashboard-main">
                <div className="dashboard-content ai-chat-page">
                    <DashboardHeader userName={firstName} />

                    <div className="ai-chat-container">
                        <div className="ai-chat-header">
                            <span className="ai-chat-header-icon"><MdChat /></span>
                            <div>
                                <h2 className="ai-chat-title">AI Assistant</h2>
                                <p className="ai-chat-subtitle">Ask anything — attach images or files for context</p>
                            </div>
                        </div>

                        <div className="ai-chat-messages">
                            {messages.length === 0 && (
                                <div className="ai-chat-empty">
                                    <span className="ai-chat-empty-icon"><MdChat /></span>
                                    <p className="ai-chat-empty-title">Start a conversation</p>
                                    <p className="ai-chat-empty-sub">
                                        Ask the AI about your handwritten documents or translations.
                                        You can also attach images, PDFs, and more.
                                    </p>
                                </div>
                            )}

                            {messages.map((msg) => (
                                <div key={msg.id} className={`ai-chat-bubble-row ${msg.role}`}>
                                    {msg.role === "assistant" && (
                                        <div className="ai-chat-avatar ai"><MdChat /></div>
                                    )}

                                    <div className={`ai-chat-bubble ${msg.role}`}>
                                        {msg.attachments && msg.attachments.length > 0 && (
                                            <div className="ai-chat-attachments">
                                                {msg.attachments.map((att) =>
                                                    att.type.startsWith("image/") ? (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img
                                                            key={att.id}
                                                            src={att.dataUrl}
                                                            alt={att.name}
                                                            className="ai-chat-attachment-img"
                                                        />
                                                    ) : (
                                                        <div key={att.id} className="ai-chat-attachment-file">
                                                            <MdInsertDriveFile className="ai-chat-attachment-file-icon" />
                                                            <div className="ai-chat-attachment-file-info">
                                                                <span className="ai-chat-attachment-file-name">{att.name}</span>
                                                                <span className="ai-chat-attachment-file-size">{formatBytes(att.size)}</span>
                                                            </div>
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                        )}

                                        {msg.content && <p>{msg.content}</p>}

                                        <span className="ai-chat-time">
                                            {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                        </span>
                                    </div>

                                    {msg.role === "user" && (
                                        <div className="ai-chat-avatar user">{firstName[0]?.toUpperCase()}</div>
                                    )}
                                </div>
                            ))}

                            {busy && (
                                <div className="ai-chat-bubble-row assistant">
                                    <div className="ai-chat-avatar ai"><MdChat /></div>
                                    <div className="ai-chat-bubble assistant ai-chat-typing">
                                        <span /><span /><span />
                                    </div>
                                </div>
                            )}

                            <div ref={messagesEndRef} />
                        </div>

                        <div className="ai-chat-input-wrapper">
                            {pendingAttachments.length > 0 && (
                                <div className="ai-chat-pending-attachments">
                                    {pendingAttachments.map((att) => (
                                        <div key={att.id} className="ai-chat-pending-chip">
                                            {att.type.startsWith("image/") ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                    src={att.dataUrl}
                                                    alt={att.name}
                                                    className="ai-chat-pending-thumb"
                                                />
                                            ) : (
                                                <MdInsertDriveFile className="ai-chat-pending-file-icon" />
                                            )}
                                            <span className="ai-chat-pending-name">{att.name}</span>
                                            <button
                                                className="ai-chat-pending-remove"
                                                onClick={() => removePendingAttachment(att.id)}
                                                aria-label={`Remove ${att.name}`}
                                            >
                                                <MdClose />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {attachError && <p className="ai-chat-attach-error">{attachError}</p>}

                            <div className="ai-chat-input-area">
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    className="ai-chat-file-input"
                                    accept="image/*,application/pdf,.pdf,.docx,.doc,.pptx,.txt"
                                    multiple
                                    onChange={(e) => handleFileSelect(e.target.files)}
                                />
                                <button
                                    className="ai-chat-attach-btn"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={busy}
                                    aria-label="Attach file"
                                    title="Attach image or file (PDF, DOCX, TXT…)"
                                >
                                    <MdAttachFile />
                                </button>

                                <textarea
                                    ref={textareaRef}
                                    className="ai-chat-input"
                                    placeholder="Type a message…"
                                    value={input}
                                    onChange={handleInputChange}
                                    onKeyDown={handleKeyDown}
                                    rows={1}
                                    disabled={busy}
                                />

                                <button
                                    className="ai-chat-send-btn"
                                    onClick={() => void handleSend()}
                                    disabled={busy || (!input.trim() && pendingAttachments.length === 0)}
                                    aria-label="Send message"
                                >
                                    <MdSend />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
