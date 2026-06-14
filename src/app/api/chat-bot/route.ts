import { NextRequest, NextResponse } from "next/server";
import os from "os";
import path from "path";
import fs from "fs/promises";

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
  return history
    .slice(-6)
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


export async function POST(req: NextRequest) {
  try {
    const { key, question, newChat } = await req.json();

    if (!key || !question?.trim()) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const db = await readDataStore();
    const userData: AnalysisData = db[key];

    if (!userData) {
      return NextResponse.json({ error: "No analysis data" }, { status: 404 });
    }

 
    if (newChat) {
      const id = createNewSession(userData);
      db[key] = userData;
      await writeDataStore(db);

      return NextResponse.json({
        success: true,
        sessionId: id,
      });
    }

    const sessionId = getSession(userData);

    if (!userData.sessions) userData.sessions = {};
    if (!userData.sessions[sessionId]) userData.sessions[sessionId] = [];

    const history = userData.sessions[sessionId];

    const cleanQuestion = sanitizeInput(question);

 
    if (isGreeting(cleanQuestion)) {
      return NextResponse.json({
        success: true,
        answer:
          "Hello 👋 I can help you with handwriting analysis, OCR, and forgery detection.",
        evidence: "greeting-rule",
        recommendations: [],
        confidence: 1,
        taskType: "greeting",
        emotion: "neutral",
        sessionId,
      });
    }

 
    const analysisData = {
      extractedText: (userData.text || "").slice(0, 3500),
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

  const systemPrompt = `
You are HandwritingAI Pro.

You are a general AI assistant with handwriting analysis capabilities.

RULES:

1) GENERAL QUESTIONS:
- Answer normally using your AI knowledge.
- You can answer questions about languages, programming, learning, advice, explanations, etc.
- Do NOT say "Not enough data" for general questions.

2) HANDWRITING / OCR QUESTIONS:
- If the user asks about handwriting analysis, OCR text, accuracy, forgery, handwriting quality:
  use only the provided analysis data.
- Never invent OCR results, scores, or handwriting measurements.
- If handwriting data is missing:
  say:
  "Not enough handwriting analysis data."

3) STYLE:
- Be concise.
- Answer only what was asked.
- Do not create long tutorials unless requested.
- Do not ask unnecessary questions.

GREETING:
If user says hello/hi/hey:
Reply:
"Hello 👋 How can I help you today?"

Return ONLY valid JSON:

{
 "answer":"",
 "evidence":"",
 "recommendations":[],
 "confidence":0.0
}
`;

    const messages = [
      { role: "system", content: systemPrompt },
      {
        role: "system",
        content: `
TASK: ${taskType}
EMOTION: ${emotion}

DATA:
${JSON.stringify(analysisData)}

CONTEXT:
${context}

MEMORY:
${memory}
`,
      },
      { role: "user", content: cleanQuestion },
    ];

    /* ---------------- MODEL ---------------- */

    const MODEL = process.env.AI_MODEL || "openai/gpt-4.1-mini";

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          messages,
          temperature: 0,
          top_p: 1,
          max_tokens: 600,
        }),
      }
    );

    const aiData = await response.json();

    if (!response.ok) {
      throw new Error(aiData?.error?.message || "AI Error");
    }

    const raw = aiData?.choices?.[0]?.message?.content || "{}";

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {
        answer: raw,
        evidence: "fallback",
        recommendations: [],
        confidence: 0.6,
      };
    }

   
    history.push({
      question: cleanQuestion,
      answer: parsed.answer,
      date: new Date().toISOString(),
    });

    userData.sessions[sessionId] = history.slice(-20);

    if (history.length % 5 === 0) {
      userData.conversationSummary = history
        .slice(-5)
        .map(h => h.question)
        .join(" | ");
    }

    db[key] = userData;
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
    return NextResponse.json(
      { success: false, error: err.message || "Server error" },
      { status: 500 }
    );
  }
}
