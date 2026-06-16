import { NextRequest, NextResponse } from "next/server";
import os from "os";
import path from "path";
import fs from "fs/promises";
import { detectLanguage } from "@/utils/detectLanguage";
import { ImageAnnotatorClient } from "@google-cloud/vision";
import pdfParse from "pdf-parse";
import JSZip from "jszip";

const visionClient = new ImageAnnotatorClient({
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
});

const tmpBase = path.join(os.tmpdir(), "handwriting-recognition");
const dataFile = path.join(tmpBase, "ocrData.json");

interface ChatHistoryItem {
  question: string;
  answer: string;
  date: string;
}

interface AnalysisData {
  text?: string;
  accuracy?: number;
  handwritingQuality?: {
    readability?: number;
    spacing?: number;
    consistency?: number;
    pressure?: number;
  };
  forgery?: {
    riskScore?: number;
    confidence?: number;
    indicators?: string[];
    summary?: string;
  };
  tips?: string[];
  summary?: string;
  sessionId?: string;
  sessions?: Record<string, ChatHistoryItem[]>;
  conversationSummary?: string;
}

async function readDataStore() {
  try {
    return JSON.parse(await fs.readFile(dataFile, "utf8"));
  } catch {
    return {};
  }
}

async function writeDataStore(data: any) {
  await fs.mkdir(tmpBase, { recursive: true });
  await fs.writeFile(dataFile, JSON.stringify(data, null, 2));
}

function semanticScore(text: string, query: string) {
  const tokens = query.toLowerCase().split(" ").filter(w => w.length > 2);
  const target = text.toLowerCase();

  let score = 0;
  for (const t of tokens) if (target.includes(t)) score += 2;
  if (/\d/.test(text)) score += 1;

  return score;
}

function getRelevantChunk(text: string, question: string) {
  if (!text) return "";
  
 
  if (text.length < 2000) return text;

  return (text.match(/.{1,650}/g) || [])
    .map(c => ({ c, s: semanticScore(c, question) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 5)
    .map(x => x.c)
    .join("\n---\n");
}

function detectTask(q: string) {
  q = q.toLowerCase();
  if (/accuracy|score|نسبة|الدقة/.test(q)) return "accuracy";
  if (/forgery|fake|تزوير/.test(q)) return "forgery";
  if (/ocr|text|extract|النص/.test(q)) return "ocr";
  if (/improve|advice|تحسين/.test(q)) return "improvement";
  return "general";
}

function detectEmotion(q: string) {
  if (/bad|worst|مش فاهم|مش واضح/.test(q)) return "frustrated";
  if (/(good|great|perfect|ممتاز)/.test(q)) return "positive";
  return "neutral";
}

function compressHistory(history: ChatHistoryItem[]) {
  // تعديل: زيادة سعة الذاكرة من 6 إلى 10 رسائل
  return history
    .slice(-10)
    .map(h => `User: ${h.question}\nAI: ${h.answer.slice(0, 100)}`)
    .join("\n");
}

function sanitizeInput(text: string) {
  return text
    .replace(/ignore previous instructions/gi, "")
    .replace(/system prompt/gi, "")
    .replace(/reveal secrets/gi, "");
}

function isGreeting(q: string) {
  const clean = q.trim().toLowerCase().replace(/[^a-z\u0600-\u06FF]/g, "");
  return /^(hi|hello|hey|مرحبا|اهلا|سلام)$/.test(clean);
}

function createNewSession(userData: AnalysisData) {
  const id = `chat_${Date.now()}`;
  userData.sessionId = id;

  if (!userData.sessions) userData.sessions = {};
  userData.sessions[id] = [];

  return id;
}

function getSession(userData: AnalysisData) {
  if (!userData.sessionId) return createNewSession(userData);
  return userData.sessionId;
}

async function extractPptxText(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const slides = Object.keys(zip.files).filter(f => f.startsWith("ppt/slides/slide"));
  let text = "";
  for (const file of slides) {
    const content = await zip.files[file].async("string");
    const matches = content.match(/<a:t>(.*?)<\/a:t>/g) || [];
    for (const m of matches) {
      text += m.replace(/<\/?a:t>/g, "") + " ";
    }
  }
  return text.trim();
}

async function extractFileText(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const ct = file.type;
  let text = "";
  
  if (ct.startsWith("image/")) {
    const [result] = await visionClient.textDetection(buffer);
    text = result.fullTextAnnotation?.text || "";
  } else if (ct === "application/pdf") {
    const parsed = await pdfParse(buffer);
    text = parsed.text || "";
  } else if (ct === "application/vnd.openxmlformats-officedocument.presentationml.presentation") {
    text = await extractPptxText(buffer);
  }
  return { text };
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let question = "";
    let key = "";
    let newChat = false;
    let uploadedText = "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      key = (formData.get("key") as string) || "";
      question = (formData.get("question") as string) || "";
      newChat = formData.get("newChat") === "true";
      const file = formData.get("file") as File | null;
      if (file) {
        const extracted = await extractFileText(file);
        uploadedText = extracted.text;
      }
    } else {
      const body = await req.json().catch(() => ({}));
      key = body.key;
      question = body.question;
      newChat = body.newChat;

      if (body.attachments && Array.isArray(body.attachments)) {
        for (const att of body.attachments) {
          if (att.dataUrl && att.dataUrl.includes(',')) {
            const base64Data = att.dataUrl.split(',')[1];
            const buffer = Buffer.from(base64Data, 'base64');
            const [result] = await visionClient.textDetection(buffer);
            uploadedText += "\n" + (result.fullTextAnnotation?.text || "");
          }
        }
      }
    }

    const cleanQuestion = sanitizeInput(question || "");
    const safeKey = key || `anon_${Date.now()}`;

    if (!cleanQuestion.trim() && !uploadedText) {
      return NextResponse.json({ error: "Empty request" }, { status: 400 });
    }

    const db = await readDataStore();
    if (!db[safeKey]) db[safeKey] = { sessions: {} };
    const userData: AnalysisData = db[safeKey];

    if (newChat) {
      const id = createNewSession(userData);
      db[safeKey] = userData;
      await writeDataStore(db);
      return NextResponse.json({ success: true, sessionId: id });
    }

    const sessionId = getSession(userData);
    if (!userData.sessions) userData.sessions = {};
    if (!userData.sessions[sessionId]) userData.sessions[sessionId] = [];
    const history = userData.sessions[sessionId];

   if (uploadedText) {
  userData.text = uploadedText.trim();
}

    if (isGreeting(cleanQuestion)) {
      return NextResponse.json({
        success: true,
        answer: "Hello 👋 How can I help you today?",
        sessionId,
      });
    }

    const analysisData = {
      extractedText: (userData.text || "").slice(0, 5000),
      accuracy: userData.accuracy ?? null,
      handwritingQuality: userData.handwritingQuality ?? null,
      forgery: userData.forgery ?? null,
      tips: userData.tips ?? [],
      summary: userData.summary ?? "",
    };

    const context = getRelevantChunk(userData.text || "", cleanQuestion);
    const taskType = detectTask(cleanQuestion);
    const emotion = detectEmotion(cleanQuestion);
    const memory = compressHistory(history);


    const systemPrompt = `You are HandwritingAI Pro.
CRITICAL: You have access to "DATA" (which contains extracted text from your previous file/image uploads). 
If the user asks about an image, file, or document, you MUST reference the 'extractedText' provided in the DATA section.
Return ONLY valid JSON: {"answer":"","evidence":"","recommendations":[],"confidence":0.0}`;
    
    const messages = [
      { role: "system", content: systemPrompt },
      { role: "system", content: `TASK: ${taskType}\nEMOTION: ${emotion}\nDATA: ${JSON.stringify(analysisData)}\nCONTEXT: ${context}\nMEMORY: ${memory}` },
      { role: "user", content: cleanQuestion },
    ];

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL || "openai/gpt-4.1-mini",
        messages,
        temperature: 0,
        max_tokens: 600,
      }),
    });

    const aiData = await response.json();
    if (!response.ok) throw new Error(aiData?.error?.message || "AI Error");

    const raw = aiData?.choices?.[0]?.message?.content || "{}";
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { answer: raw, evidence: "fallback", recommendations: [], confidence: 0.6 };
    }

    history.push({ question: cleanQuestion, answer: parsed.answer, date: new Date().toISOString() });
    userData.sessions[sessionId] = history.slice(-20);
    db[safeKey] = userData;
    await writeDataStore(db);

    return NextResponse.json({
      success: true,
      answer: parsed.answer,
      evidence: parsed.evidence,
      recommendations: parsed.recommendations,
      confidence: parsed.confidence ?? 0.8,
      taskType,
      emotion,
      sessionId,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || "Server error" }, { status: 500 });
  }
}
