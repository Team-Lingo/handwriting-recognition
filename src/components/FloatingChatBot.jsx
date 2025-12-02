// components/FloatingChatBot.jsx
"use client";
import { useState, useRef, useEffect } from "react";

export default function FloatingChatBot() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [ocrKey, setOcrKey] = useState(null);
  const messagesEndRef = useRef(null);

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const toggleChat = () => setIsOpen(!isOpen);

  const handleSend = async () => {
    if (!input && !file) return;

    // Add user message
    const userMsg = { type: "user", text: input || file.name };
    setMessages((prev) => [...prev, userMsg]);

    try {
      let url = "";
      let options = {};

      // ============ 1) لو هنرفع صورة =============
      if (file) {
        const formData = new FormData();
        formData.append("file", file);

        url = "/api/ocr";
        options = { method: "POST", body: formData };
      }

      // ============ 2) لو هنرسل سؤال =============
      if (!file) {
        if (!ocrKey) {
          setMessages((prev) => [
            ...prev,
            { type: "bot", text: "⚠️ لازم ترفعي صورة الأول عشان أقدر أفهم سياق الأسئلة." }
          ]);
          return;
        }

        url = `/api/ocr?key=${ocrKey}&question=${encodeURIComponent(input)}`;
        options = { method: "GET" };
      }

      const res = await fetch(url, options);
      const data = await res.json();

      // ============ 3) معالجة رد الصورة ============
      if (file) {
        setOcrKey(data.key);

        const botText =
          `📄 **النص المستخرج:**\n${data.correctedText || data.text}\n\n` +
          `📝 **الملاحظات:**\n${data.notes?.join("\n") || "No notes"}\n\n` +
          `🔑 **Key:** ${data.key}`;

        setMessages((prev) => [...prev, { type: "bot", text: botText }]);
        setFile(null);
        setInput("");
        return;
      }

      // ============ 4) معالجة رد الأسئلة ============
      const botReply = data.answer || "❌ لم أتمكن من إنشاء رد.";
      setMessages((prev) => [...prev, { type: "bot", text: botReply }]);
      setInput("");

    } catch (err) {
      setMessages((prev) => [...prev, { type: "bot", text: "⚠️ حدث خطأ. حاول مرة أخرى." }]);
      console.error(err);
    }
  };

  return (
    <>
      <button
        onClick={toggleChat}
        className="fixed bottom-4 right-4 bg-blue-600 text-white rounded-full w-14 h-14 text-2xl flex items-center justify-center shadow-lg z-50 hover:bg-blue-700"
      >
        💬
      </button>

      {isOpen && (
        <div className="fixed bottom-20 right-4 w-80 h-96 bg-white border rounded-xl shadow-xl flex flex-col overflow-hidden z-50">

          {/* HEADER */}
          <div className="bg-blue-600 text-white p-3 font-semibold flex justify-between">
            <span>المساعد الذكي</span>
            <button onClick={toggleChat}>✖</button>
          </div>

          {/* MESSAGES */}
          <div className="flex-1 p-3 overflow-y-auto space-y-3 bg-gray-50">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`whitespace-pre-wrap p-2 rounded-xl max-w-[80%] leading-relaxed ${
                  msg.type === "user"
                    ? "bg-blue-500 text-white ml-auto"
                    : "bg-white border text-gray-800"
                }`}
              >
                {msg.text}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* INPUT AREA */}
          <div className="p-2 border-t flex items-center space-x-2 bg-white">
            <input
              type="file"
              onChange={(e) => setFile(e.target.files[0])}
              className="text-sm w-24"
            />

            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey ? (e.preventDefault(), handleSend()) : null}
              placeholder="اكتب سؤالك..."
              className="flex-1 border rounded-lg p-2 text-sm resize-none h-10"
            />

            <button
              onClick={handleSend}
              className="bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700"
            >
              إرسال
            </button>
          </div>
        </div>
      )}
    </>
  );
}
