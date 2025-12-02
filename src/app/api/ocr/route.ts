import { NextRequest, NextResponse } from "next/server";
import { ImageAnnotatorClient } from "@google-cloud/vision";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { detectLanguage } from "@/utils/detectLanguage";
import levenshtein from "fast-levenshtein";

// =================== Types ===================
export interface OcrResponse {
  text: string;
  correctedText?: string;
  accuracy?: number;
  notes?: string[];
  history?: { question: string; answer: string }[];
  language: string;
}

// =================== Config ===================
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const visionClient = new ImageAnnotatorClient({
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
});

const dataFile = path.join(process.cwd(), ".tmp", "ocrData.json");

// =================== Helpers ===================
function getReason(match: any): string {
  if (match.rule?.description) return match.rule.description.toLowerCase();
  if (match.rule?.issueType) {
    switch (match.rule.issueType.toLowerCase()) {
      case "misspelling": return "fixed a common spelling mistake";
      case "grammar": return "corrected grammar issue";
      default: return "corrected language issue";
    }
  }
  return "corrected error";
}

function generateLocalReply(userData: OcrResponse, question: string): string {
  const text = userData.correctedText || userData.text;
  const notes = userData.notes?.join("; ") || "No notes";
  const accuracy = userData.accuracy ?? "unknown";
  return `سؤالك: "${question}". التحليل الذكي: ${notes}. دقة النص: ${accuracy}%`;
}

// =================== POST ===================
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const fileUrl = form.get("fileUrl") as string | null;

    const tmpBase = path.join(process.cwd(), ".tmp");
    await fs.mkdir(tmpBase, { recursive: true });

    let tmp: string;
    if (fileUrl) {
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error("Failed to fetch file from URL");
      const buffer = Buffer.from(await response.arrayBuffer());
      tmp = path.join(tmpBase, crypto.randomUUID());
      await fs.writeFile(tmp, buffer);
    } else if (file) {
      tmp = path.join(tmpBase, crypto.randomUUID());
      await fs.writeFile(tmp, Buffer.from(await file.arrayBuffer()));
    } else {
      return NextResponse.json({ error: "No file or fileUrl provided" }, { status: 400 });
    }

    const [result] = await visionClient.textDetection(tmp);
    await fs.unlink(tmp);

    const text = result.fullTextAnnotation?.text || "";
    const language = detectLanguage(text);

    let payload: OcrResponse = {
      text,
      language,
      correctedText: undefined,
      accuracy: undefined,
      notes: undefined,
      history: [],
    };

    // ================== English correction ==================
    if (language === "English") {
      try {
        const ltRes = await fetch("https://api.languagetool.org/v2/check", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ text, language: "en-US" }),
        });

        if (ltRes.ok) {
          const data = await ltRes.json();
          let correctedText = text;
          const matches: any[] = data.matches || [];
          matches.sort((a, b) => b.offset - a.offset);

          for (const match of matches) {
            if (match.replacements && match.replacements.length > 0) {
              const start = match.offset;
              const end = start + match.length;
              correctedText =
                correctedText.slice(0, start) + match.replacements[0].value + correctedText.slice(end);
            }
          }

          const distance = levenshtein.get(text, correctedText);
          const maxLength = Math.max(text.length, correctedText.length);
          const accuracy = maxLength > 0 ? (1 - distance / maxLength) * 100 : 100;

          const notes = Array.from(
            new Set(
              matches
                .map((m) => {
                  if (m.replacements && m.replacements.length > 0) {
                    const original = text.slice(m.offset, m.offset + m.length);
                    const corrected = m.replacements[0].value;
                    return `Corrected "${original}" to "${corrected}" → ${getReason(m)}`;
                  }
                  return m.message ?? "";
                })
                .filter(Boolean)
            )
          );

          payload = {
            ...payload,
            correctedText,
            accuracy: Math.round(accuracy * 100) / 100,
            notes,
          };
        }
      } catch (error) {
        console.error("LanguageTool API error:", error);
      }
    }

    // ================== Save OCR data ==================
    let existingData: Record<string, OcrResponse> = {};
    try {
      const raw = await fs.readFile(dataFile, "utf-8");
      existingData = JSON.parse(raw);
    } catch {}

    const key = crypto.createHash("md5").update(text).digest("hex");
    existingData[key] = payload;
    await fs.writeFile(dataFile, JSON.stringify(existingData, null, 2), "utf-8");

    return NextResponse.json({ key, ...payload });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: (err as Error).message || "OCR failed" },
      { status: 500 }
    );
  }
}

// =================== GET ===================
export async function GET(req: NextRequest) {
  try {
    const key = req.nextUrl.searchParams.get("key");
    const question = req.nextUrl.searchParams.get("question") || "";
    if (!key) return NextResponse.json({ error: "No key provided" }, { status: 400 });

    const raw = await fs.readFile(dataFile, "utf-8");
    const existingData: Record<string, OcrResponse> = JSON.parse(raw);
    const userData = existingData[key];
    if (!userData) return NextResponse.json({ error: "No data found for this key" }, { status: 404 });

    // ================== Simple response filter ==================
    const simpleResponses: Record<string, string> = {
      "شكرا لك": "على الرحب والسعة! 😊",
      "شكراً لك": "على الرحب والسعة! 😊",
      "thank you": "You're welcome! 😊",
      "thanks": "You're welcome! 😊",
      "hi": "Hello! How can I help you today? 🙂",
      "مرحبا": "أهلاً! كيف يمكنني مساعدتك اليوم؟ 🙂",
    };

    const lowerQuestion = question.trim().toLowerCase();
    if (simpleResponses[lowerQuestion]) {
      // Save history even for simple replies
      userData.history = userData.history || [];
      userData.history.push({ question, answer: simpleResponses[lowerQuestion] });
      existingData[key] = userData;
      await fs.writeFile(dataFile, JSON.stringify(existingData, null, 2), "utf-8");

      return NextResponse.json({ answer: simpleResponses[lowerQuestion] });
    }

    const questionLang = /[ء-ي]/.test(question) ? "ar" : "en";

    // ================= OpenRouter LLM call =================
    const OR_KEY = process.env.OPENROUTER_API_KEY;
    const OR_MODEL = process.env.OPENROUTER_MODEL || "meta-llama/llama-3.1-8b-instruct";

    const historyText = userData.history?.map((h) => `User: ${h.question}\nAssistant: ${h.answer}`).join("\n") || "";

    const prompt = `
You are a super-intelligent assistant like ChatGPT.
Extracted text: "${userData.correctedText || userData.text}"
Accuracy: ${userData.accuracy ?? "unknown"}%
Notes: ${userData.notes?.join("; ") || "No notes"}
Conversation history:
${historyText}
User question: "${question}"
Language: ${questionLang === "ar" ? "Arabic" : "English"}
Answer clearly, helpfully, with examples if possible, in user's language, using context and notes.
`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OR_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OR_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 700,
      }),
    });

    let answer = "";
    if (response.ok) {
      const data = await response.json();
      answer = data.choices?.[0]?.message?.content || generateLocalReply(userData, question);
    } else {
      answer = generateLocalReply(userData, question);
    }

    // ================= Save history ==================
    userData.history = userData.history || [];
    userData.history.push({ question, answer });
    existingData[key] = userData;
    await fs.writeFile(dataFile, JSON.stringify(existingData, null, 2), "utf-8");

    return NextResponse.json({ answer });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to fetch chat answer", details: (err as Error).message },
      { status: 500 }
    );
  }
}
 
