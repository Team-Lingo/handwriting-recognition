"use client";
import { useEffect, useState, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import ImageUploader from "@/components/ImageUploader";
import { OcrResponse } from "@/types/ocr";
import { getDownloadURL, ref } from "firebase/storage";
import { storage } from "@/lib/firebase";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

function DashboardContent() {
  const { user, userProfile, loading, signOut } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [result, setResult] = useState<OcrResponse | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [ocrKey, setOcrKey] = useState<string>("");

  // --- الشات بوت ---
  const [chatVisible, setChatVisible] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatMinimized, setChatMinimized] = useState(false);
  const chatWindowRef = useRef<HTMLDivElement>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  useEffect(() => {
    const analyzeFile = async () => {
      const storagePath = searchParams.get("analyze");
      if (!storagePath || !user) return;

      setAnalyzing(true);
      try {
        const url = await getDownloadURL(ref(storage, storagePath));
        setImageUrl(url);

        const formData = new FormData();
        formData.append("fileUrl", url);

        const ocrResponse = await fetch("/api/ocr", { method: "POST", body: formData });
        const data: OcrResponse & { key: string } = await ocrResponse.json();
        setResult(data);
        setOcrKey(data.key); 

        setChatMessages([{ role: "system", content: "Image analyzed successfully! You can ask questions now." }]);
      } catch (error) {
        console.error("Analysis failed:", error);
        alert("Failed to analyze image. Please try again.");
      } finally {
        setAnalyzing(false);
      }
    };

    analyzeFile();
  }, [searchParams, user]);

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || !ocrKey) return;

    setChatMessages((prev) => [...prev, { role: "user", content: chatInput }]);
    const question = chatInput;
    setChatInput("");

    try {
      const res = await fetch(`/api/ocr?key=${ocrKey}&question=${encodeURIComponent(question)}`);
      const data = await res.json();
      setChatMessages((prev) => [...prev, { role: "assistant", content: data.answer || "No answer available" }]);
    } catch (err) {
      console.error("Chat API error:", err);
      setChatMessages((prev) => [...prev, { role: "assistant", content: "Failed to get answer" }]);
    }
  };

  // --- draggable handlers ---
  const handleMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    setDragOffset({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging || !chatWindowRef.current) return;
    const dx = e.clientX - dragOffset.x;
    const dy = e.clientY - dragOffset.y;
    chatWindowRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
  };

  const handleMouseUp = () => {
    setDragging(false);
  };

  return (
    <main className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1>Handwriting Recognition Dashboard</h1>
          {userProfile && (
            <p className="user-greeting">
              Welcome, {userProfile.firstName} {userProfile.lastName}!
            </p>
          )}
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => router.push("/files")} className="btn">Files</button>
          <button onClick={() => router.push("/profile")} className="btn btn-primary">{userProfile?.firstName}</button>
          <button onClick={handleSignOut} className="btn btn-secondary">Sign Out</button>
        </div>
      </div>

      <ImageUploader />

      {analyzing && (
        <div className="card text-center mt-4">
          <p>Analyzing image...</p>
        </div>
      )}

      {imageUrl && !analyzing && (
        <div className="card text-center mt-4">
          <img src={imageUrl} alt="Analyzed image" style={{ maxHeight: "220px", objectFit: "contain", margin: "0 auto" }} />
        </div>
      )}

      {result && (
        <div className="result-card mt-4">
          <p className="result-language">Detected language: {result.language}</p>
          <div className="result-section">
            <h3>Original Text:</h3>
            <pre className="result-text">{result.text}</pre>
          </div>
          {result.correctedText && (
            <div className="result-section">
              <h3>Corrected Text:</h3>
              <pre className="result-text">{result.correctedText}</pre>
            </div>
          )}
          {result.accuracy !== undefined && (
            <div className="result-section">
              <p className="result-accuracy">Accuracy: {result.accuracy}%</p>
            </div>
          )}
          {result.notes && result.notes.length > 0 && (
            <div className="result-section">
              <h3>Correction Notes:</h3>
              <ul className="result-notes">
                {result.notes.map((note, idx) => (<li key={idx}>{note}</li>))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* --- زر فتح/غلق الشات --- */}
      {ocrKey && (
        <button
          className="chat-bot-toggle"
          onClick={() => setChatVisible((prev) => !prev)}
        >
          {chatVisible ? "Close Chat" : "Open Chat"}
        </button>
      )}

      {/* --- نافذة الشات --- */}
      {chatVisible && (
        <div
          className="chat-bot-window"
          ref={chatWindowRef}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          <div
            className="chat-bot-header cursor-move flex justify-between items-center"
            onMouseDown={handleMouseDown}
          >
            <span>Chat Bot</span>
            <button onClick={() => setChatMinimized((prev) => !prev)}>
              {chatMinimized ? "▲" : "▼"}
            </button>
          </div>

          {!chatMinimized && (
            <>
              <div className="chat-bot-messages">
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={msg.role === "user" ? "chat-message-user" : "chat-message-assistant"}>
                    {msg.content}
                  </div>
                ))}
              </div>
              <div className="chat-bot-input-container">
                <input
                  type="text"
                  className="chat-bot-input"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Type your question..."
                  onKeyDown={(e) => { if (e.key === "Enter") sendChatMessage(); }}
                />
                <button className="chat-bot-send-btn" onClick={sendChatMessage}>Send</button>
              </div>
            </>
          )}
        </div>
      )}
    </main>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="dashboard-container"><div className="loading">Loading...</div></div>}>
      <DashboardContent />
    </Suspense>
  );
}
