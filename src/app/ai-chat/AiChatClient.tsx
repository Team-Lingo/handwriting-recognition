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
    
    const [ocrKey, setOcrKey] = useState<string | null>(() => {
        if (typeof window !== "undefined") {
            return localStorage.getItem("ocr_session_key");
        }
        return null;
    });

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (ocrKey) {
            localStorage.setItem("ocr_session_key", ocrKey);
        } else {
            localStorage.removeItem("ocr_session_key");
        }
    }, [ocrKey]);

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

        setBusy(true);
        let currentKey = ocrKey;

        try {
            if (pendingAttachments.length > 0) {
                const formData = new FormData();
                const fileResponse = await fetch(pendingAttachments[0].dataUrl);
                const blob = await fileResponse.blob();
                formData.append("file", blob, pendingAttachments[0].name);

                const res = await fetch("/api/ocr", { method: "POST", body: formData });
                const data = await res.json();
                
                if (data.key) {
                    currentKey = data.key;
                    setOcrKey(data.key);
                }
            }

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
            if (textareaRef.current) textareaRef.current.style.height = "auto";

            const queryParams = new URLSearchParams({ question: text });
            if (currentKey) queryParams.append("key", currentKey);
            
            const res = await fetch(`/api/ocr?${queryParams.toString()}`);
            const data = await res.json();

            setMessages((prev) => [
                ...prev,
                { id: createId(), role: "assistant", content: data.answer || "عذراً، لم أستطع الرد.", timestamp: new Date() },
            ]);
        } catch (e: any) {
            setMessages((prev) => [
                ...prev,
                { id: createId(), role: "assistant", content: "عذراً، حدث خطأ في الاتصال بالسيرفر.", timestamp: new Date() },
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

    if (loading || !user) return <div className="dashboard-layout"><div className="loading-container">Loading…</div></div>;

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
                                <p className="ai-chat-subtitle">Ask anything - attach images or files for context</p>
                            </div>
                        </div>

                        <div className="ai-chat-messages">
                            {messages.map((msg) => (
                                <div key={msg.id} className={`ai-chat-bubble-row ${msg.role}`}>
                                    {msg.role === "assistant" && <div className="ai-chat-avatar ai"><MdChat /></div>}
                                    <div className={`ai-chat-bubble ${msg.role}`}>
                                        {msg.attachments && (
                                            <div className="msg-attachments">
                                                {msg.attachments.map(a => (
                                                    <div key={a.id} className="msg-attachment-item"><MdInsertDriveFile /> {a.name}</div>
                                                ))}
                                            </div>
                                        )}
                                        {msg.content && <p>{msg.content}</p>}
                                    </div>
                                </div>
                            ))}
                            {busy && <div className="ai-chat-bubble-row assistant"><div className="ai-chat-bubble assistant">جاري التفكير...</div></div>}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* منطقة معاينة الملفات المرفقة */}
                        {pendingAttachments.length > 0 && (
                            <div className="ai-chat-attachments-preview">
                                {pendingAttachments.map((file) => (
                                    <div key={file.id} className="attachment-preview-item">
                                        <MdInsertDriveFile />
                                        <span>{file.name} ({formatBytes(file.size)})</span>
                                        <button onClick={() => removePendingAttachment(file.id)}><MdClose /></button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="ai-chat-input-wrapper">
                            <div className="ai-chat-input-area">
                                <input ref={fileInputRef} type="file" className="ai-chat-file-input" onChange={(e) => handleFileSelect(e.target.files)} hidden />
                                <button className="ai-chat-attach-btn" onClick={() => fileInputRef.current?.click()}><MdAttachFile /></button>
                                <textarea ref={textareaRef} className="ai-chat-input" placeholder="Ask me anything..." value={input} onChange={handleInputChange} onKeyDown={handleKeyDown} rows={1} />
                                <button className="ai-chat-send-btn" onClick={() => void handleSend()} disabled={busy}><MdSend /></button>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
