"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
    MdSend,
    MdChat,
    MdAttachFile,
    MdInsertDriveFile,
    MdClose
} from "react-icons/md";

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

const MAX_FILE_SIZE = 10 * 1024 * 1024;

function createId() {
    return globalThis.crypto && "randomUUID" in globalThis.crypto
        ? globalThis.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function AiChatClient() {
    const { user, userProfile, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [busy, setBusy] = useState(false);
    const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);

    const [ocrKey, setOcrKey] = useState<string | null>(() => {
        if (typeof window !== "undefined") return localStorage.getItem("ocr_session_key");
        return null;
    });

    const [sessionId, setSessionId] = useState<string | null>(() => {
        if (typeof window !== "undefined") return localStorage.getItem("chat_session_id");
        return null;
    });

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (ocrKey) localStorage.setItem("ocr_session_key", ocrKey);
    }, [ocrKey]);

    useEffect(() => {
        if (sessionId) localStorage.setItem("chat_session_id", sessionId);
    }, [sessionId]);

    useEffect(() => {
        if (!loading && !user) {
            router.push(`/auth?next=${encodeURIComponent(pathname || "/ai-chat")}`);
        }
    }, [loading, user]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, busy]);

    const firstName = userProfile?.firstName || user?.displayName?.split(" ")[0] || "User";

    const handleNewChat = async () => {
        setMessages([]);
        setInput("");
        setPendingAttachments([]);
        setSessionId(null);
        try {
            const res = await fetch("/api/chat-bot", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ key: ocrKey || `anon_${Date.now()}`, question: "new chat", newChat: true })
            });
            const data = await res.json();
            if (data.sessionId) setSessionId(data.sessionId);
        } catch (err) {
            console.log(err);
        }
    };

    const handleFileSelect = (files: FileList | null) => {
        if (!files) return;
        for (const file of Array.from(files)) {
            if (file.size > MAX_FILE_SIZE) continue;
            const reader = new FileReader();
            reader.onload = (e) => {
                setPendingAttachments((prev) => [
                    ...prev,
                    { id: createId(), name: file.name, type: file.type, dataUrl: e.target?.result as string, size: file.size }
                ]);
            };
            reader.readAsDataURL(file);
        }
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleSend = async () => {
        const text = input.trim();
        if (busy || (!text && pendingAttachments.length === 0)) return;

        setBusy(true);
        let currentKey = ocrKey || `anon_${Date.now()}`;

        // نسخ الملفات للإرسال قبل مسح الـ state
        const attachmentsToSend = [...pendingAttachments];

        setMessages((prev) => [
            ...prev,
            { id: createId(), role: "user", content: text, attachments: attachmentsToSend, timestamp: new Date() }
        ]);

        setInput("");
        setPendingAttachments([]);

        try {
            const response = await fetch("/api/chat-bot", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    key: currentKey,
                    question: text,
                    attachments: attachmentsToSend // تم إضافة المرفقات هنا
                })
            });

            const data = await response.json();
            setMessages((prev) => [
                ...prev,
                { id: createId(), role: "assistant", content: data.answer || data.error, timestamp: new Date() }
            ]);
        } catch {
            setMessages((prev) => [
                ...prev,
                { id: createId(), role: "assistant", content: "حدث خطأ في الاتصال بالسيرفر.", timestamp: new Date() }
            ]);
        } finally {
            setBusy(false);
        }
    };

    if (loading || !user) return null;

    return (
        <div className="dashboard-layout">
            <DashboardSidebar user={user} userProfile={userProfile} />
            <main className="dashboard-main">
                <div className="dashboard-content ai-chat-page">
                    <DashboardHeader userName={firstName} />
                    <div className="ai-chat-container">
                        <div className="new-chat-wrapper">
                            <button className="new-chat-btn" onClick={handleNewChat}>+ New Chat</button>
                        </div>
                        <div className="ai-chat-header">
                            <div className="ai-icon"><MdChat /></div>
                            <div><h2>AI Assistant</h2><p>Ask anything - attach files</p></div>
                        </div>

                        <div className="ai-chat-messages">
                            {messages.map((msg) => (
                                <div key={msg.id} className={`ai-chat-bubble-row ${msg.role}`}>
                                    {msg.role === "assistant" && <div className="ai-chat-avatar"><MdChat /></div>}
                                    <div className={`ai-chat-bubble ${msg.role}`}>
                                        {msg.attachments && (
                                            <div className="msg-attachments">
                                                {msg.attachments.map((a) => (
                                                    <div key={a.id}><MdInsertDriveFile /> {a.name}</div>
                                                ))}
                                            </div>
                                        )}
                                        <p>{msg.content}</p>
                                    </div>
                                </div>
                            ))}
                            {busy && <div className="ai-chat-bubble assistant">جاري التفكير...</div>}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* منطقة عرض الملفات المعلقة قبل الإرسال */}
                        {pendingAttachments.length > 0 && (
                            <div className="pending-attachments">
                                {pendingAttachments.map((a) => (
                                    <span key={a.id} className="attachment-tag">
                                        {a.name} <MdClose onClick={() => setPendingAttachments(prev => prev.filter(p => p.id !== a.id))} />
                                    </span>
                                ))}
                            </div>
                        )}

                        <div className="ai-chat-input-wrapper">
                            <input ref={fileInputRef} type="file" hidden onChange={(e) => handleFileSelect(e.target.files)} />
                            <button className="attach-btn" onClick={() => fileInputRef.current?.click()}><MdAttachFile /></button>
                            <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask me anything..." />
                            <button className="send-btn" disabled={busy} onClick={handleSend}><MdSend /></button>
                        </div>
                    </div>
                </div>
            </main>

            <style jsx>{`
                .pending-attachments { display: flex; gap: 5px; padding: 5px 15px; background: #f0f0f0; }
                .attachment-tag { display: flex; align-items: center; background: #e0e0e0; padding: 2px 8px; border-radius: 4px; font-size: 12px; }
                /* ... باقي الـ styles القديمة ... */
                .ai-chat-page{ height:calc(100vh - 90px); display:flex; justify-content:center; align-items:center; }
                .ai-chat-container{ width:100%; max-width:1100px; height:85vh; background:white; border-radius:18px; border:1px solid #e5e7eb; box-shadow:0 10px 30px #00000012; padding:14px; display:flex; flex-direction:column; }
                .new-chat-wrapper{ display:flex; justify-content:flex-end; margin-bottom:10px; }
                .new-chat-btn{ background:#111827; color:white; border:none; border-radius:10px; padding:7px 16px; font-size:12px; cursor:pointer; }
                .ai-chat-header{ display:flex; gap:14px; align-items:center; padding:15px; border-bottom:1px solid #eee; }
                .ai-icon{ width:40px; height:40px; border-radius:12px; background:#1e4fa3; color:white; display:flex; align-items:center; justify-content:center; font-size:22px; }
                .ai-chat-header h2{ margin:0; font-size:18px; }
                .ai-chat-header p{ margin:3px 0; font-size:12px; color:#6b7280; }
                .ai-chat-messages{ flex:1; overflow-y:auto; padding:20px; display:flex; flex-direction:column; gap:15px; }
                .ai-chat-bubble-row{ display:flex; gap:10px; }
                .ai-chat-bubble-row.user{ justify-content:flex-end; }
                .ai-chat-bubble{ max-width:65%; padding:12px 16px; border-radius:16px; }
                .ai-chat-bubble.user{ background:#1e4fa3; color:white; border-bottom-right-radius:4px; }
                .ai-chat-bubble.assistant{ background:#f3f4f6; color:#111827; border-bottom-left-radius:4px; }
                .ai-chat-avatar{ width:32px; height:32px; background:#1e4fa3; color:white; border-radius:50%; display:flex; align-items:center; justify-content:center; }
                .msg-attachments div{ display:flex; gap:5px; font-size:12px; }
                .ai-chat-input-wrapper{ display:flex; align-items:center; gap:10px; background:#f9fafb; border:1px solid #d1d5db; border-radius:18px; padding:8px 12px; }
                .ai-chat-input-wrapper textarea{ flex:1; border:none; outline:none; resize:none; background:transparent; padding:10px; }
                .attach-btn, .send-btn{ width:38px; height:38px; border:none; border-radius:12px; background:#1e4fa3; color:white; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:20px; }
                .send-btn:disabled{ opacity:.5; }
            `}</style>
        </div>
    );
}
