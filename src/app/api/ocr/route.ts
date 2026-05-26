import { NextRequest, NextResponse } from "next/server";
import { ImageAnnotatorClient } from "@google-cloud/vision";
import os from "os";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { detectLanguage } from "@/utils/detectLanguage";
import levenshtein from "fast-levenshtein";
import pdfParse from "pdf-parse";
import JSZip from "jszip";
import mammoth from "mammoth";
import * as XLSX from "xlsx";

// =================== Types ===================
export interface OcrResponse {
    text: string;
    correctedText?: string;
    accuracy?: number;
    notes?: string[];
    history?: { question: string; answer: string }[];
    language: string;
}

type LanguageToolRule = {
    description?: string;
    issueType?: string;
};

type LanguageToolReplacement = {
    value: string;
};

type LanguageToolMatch = {
    offset: number;
    length: number;
    message?: string;
    rule?: LanguageToolRule;
    replacements?: LanguageToolReplacement[];
};

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

const tmpBase = path.join(os.tmpdir(), "handwriting-recognition");
const dataFile = path.join(tmpBase, "ocrData.json");

async function ensureTmpDir(): Promise<void> {
    await fs.mkdir(tmpBase, { recursive: true });
}

type FileKind = "image" | "pdf" | "pptx" | "docx" | "xlsx";

function inferFileKind(contentType: string | null | undefined, filename: string | null | undefined): FileKind {
    const lowerName = (filename || "").toLowerCase();
    const ct = (contentType || "").toLowerCase();
    
    if (ct.startsWith("image/")) return "image";
    if (ct === "application/pdf" || lowerName.endsWith(".pdf")) return "pdf";
    if (
        ct === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
        lowerName.endsWith(".pptx")
    ) {
        return "pptx";
    }
    if (
        ct === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || 
        lowerName.endsWith(".docx")
    ) {
        return "docx";
    }
    if (
        ct === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || 
        ct === "application/vnd.ms-excel" || 
        lowerName.endsWith(".xlsx") || 
        lowerName.endsWith(".xls")
    ) {
        return "xlsx";
    }
    
    return "image";
}

function decodeXmlEntities(input: string): string {
    return input
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
}

async function extractPptxText(buffer: Buffer): Promise<string> {
    const zip = await JSZip.loadAsync(buffer);
    const slideFiles = Object.keys(zip.files)
        .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
        .sort((a, b) => {
            const na = Number(a.match(/slide(\d+)\.xml$/)?.[1] || 0);
            const nb = Number(b.match(/slide(\d+)\.xml$/)?.[1] || 0);
            return na - nb;
        });

    const chunks: string[] = [];
    for (const slideName of slideFiles) {
        const xml = await zip.file(slideName)!.async("string");
        const texts: string[] = [];
        const re = /<a:t[^>]*>([\s\S]*?)<\/a:t>/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(xml))) {
            const t = decodeXmlEntities(m[1] || "").trim();
            if (t) texts.push(t);
        }
        if (texts.length) {
            chunks.push(texts.join(" "));
        }
    }

    return chunks.join("\n\n").trim();
}

async function extractExcelText(buffer: Buffer): Promise<string> {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const chunks: string[] = [];
    
    for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        // تحويل الجدول إلى نص مفصول بمسافات واسطر
        const sheetText = XLSX.utils.sheet_to_txt(worksheet);
        if (sheetText.trim()) {
            chunks.push(`--- Sheet: ${sheetName} ---\n${sheetText}`);
        }
    }
    return chunks.join("\n\n").trim();
}

// =================== Helpers ===================
function getReason(match: LanguageToolMatch): string {
    if (match.rule?.description) return match.rule.description.toLowerCase();
    if (match.rule?.issueType) {
        switch (match.rule.issueType.toLowerCase()) {
            case "misspelling":
                return "fixed a common spelling mistake";
            case "grammar":
                return "corrected grammar issue";
            default:
                return "corrected language issue";
        }
    }
    return "corrected error";
}

function generateLocalReply(userData: OcrResponse, question: string): string {
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

        await ensureTmpDir();

        let buffer: Buffer;
        let contentType: string | null = null;
        let filename: string | null = null;
        if (fileUrl) {
            const response = await fetch(fileUrl);
            if (!response.ok) throw new Error("Failed to fetch file from URL");
            buffer = Buffer.from(await response.arrayBuffer());
            contentType = response.headers.get("content-type");
            try {
                const u = new URL(fileUrl);
                filename = u.pathname.split("/").pop() || null;
            } catch {
                filename = null;
            }
        } else if (file) {
            buffer = Buffer.from(await file.arrayBuffer());
            contentType = file.type || null;
            filename = file.name || null;
        } else {
            return NextResponse.json({ error: "No file or fileUrl provided" }, { status: 400 });
        }

        const kind = inferFileKind(contentType, filename);

        let text = "";
        if (kind === "pdf") {
            const parsed = await pdfParse(buffer);
            text = (parsed.text || "").trim();
        } else if (kind === "pptx") {
            text = await extractPptxText(buffer);
        } else if (kind === "docx") {
            const result = await mammoth.extractRawText({ buffer });
            text = (result.value || "").trim();
        } else if (kind === "xlsx") {
            text = await extractExcelText(buffer);
        } else {
            // Image OCR via Google Vision
            const [result] = await visionClient.textDetection(buffer);
            text = result.fullTextAnnotation?.text || "";
        }
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
                    const data = (await ltRes.json()) as { matches?: LanguageToolMatch[] };
                    let correctedText = text;
                    const matches: LanguageToolMatch[] = data.matches || [];
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
                                .filter(Boolean),
                        ),
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
        return NextResponse.json({ error: (err as Error).message || "File processing failed" }, { status: 500 });
    }
}

// =================== GET ===================
export async function GET(req: NextRequest) {
    try {
        await ensureTmpDir();
        const key = req.nextUrl.searchParams.get("key");
        const question = req.nextUrl.searchParams.get("question") || "";
        if (!key) return NextResponse.json({ error: "No key provided" }, { status: 400 });

        let existingData: Record<string, OcrResponse> = {};
        try {
            const raw = await fs.readFile(dataFile, "utf-8");
            existingData = JSON.parse(raw);
        } catch {
            return NextResponse.json({ error: "No data found for this key" }, { status: 404 });
        }
        const userData = existingData[key];
        if (!userData) return NextResponse.json({ error: "No data found for this key" }, { status: 404 });

        // ================== Simple response filter ==================
        const simpleResponses: Record<string, string> = {
            "شكرا لك": "على الرحب والسعة! 😊",
            "شكراً لك": "على الرحب والسعة! 😊",
            "thank you": "You're welcome! 😊",
            thanks: "You're welcome! 😊",
            hi: "Hello! How can I help you today? 🙂",
            مرحبا: "أهلاً! كيف يمكنني مساعدتك اليوم؟ 🙂",
        };

        const lowerQuestion = question.trim().toLowerCase();
        if (simpleResponses[lowerQuestion]) {
            userData.history = userData.history || [];
            userData.history.push({ question, answer: simpleResponses[lowerQuestion] });
            existingData[key] = userData;
            await fs.writeFile(dataFile, JSON.stringify(existingData, null, 2), "utf-8");

            return NextResponse.json({ answer: simpleResponses[lowerQuestion] });
        }

        const questionLang = /[ء-ي]/.test(question) ? "ar" : "en";

        const historyText =
            userData.history?.map((h) => `User: ${h.question}\nAssistant: ${h.answer}`).join("\n") || "";

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

        let answer = "";
        let usedFallback = false;

        // 1. المحاولة الأولى: استخدام الموديل الأساسي من OpenRouter
        try {
            const OR_KEY = process.env.OPENROUTER_API_KEY;
            const OR_MODEL = process.env.OPENROUTER_MODEL || "meta-llama/llama-3.1-8b-instruct";

            if (!OR_KEY) throw new Error("OpenRouter key missing");

            const orResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: { Authorization: `Bearer ${OR_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: OR_MODEL,
                    messages: [{ role: "user", content: prompt }],
                    temperature: 0.7,
                    max_tokens: 700,
                }),
            });

            if (orResponse.ok) {
                const data = await orResponse.json();
                answer = data.choices?.[0]?.message?.content || "";
            } else {
                throw new Error(`OpenRouter failed with status ${orResponse.status}`);
            }
        } catch (orError) {
            console.warn("Primary LLM (OpenRouter) failed, switching to Fallback Gemini...", orError);
            usedFallback = true;
        }

        // 2. المحاولة الثانية (Fallback): العمل تلقائياً بـ Gemini إذا فشل الموديل الأساسي
        if (usedFallback || !answer) {
            try {
                const GEMINI_KEY = process.env.GEMINI_API_KEY;
                if (!GEMINI_KEY) throw new Error("Gemini API key missing");

                // استدعاء واجهة جوجل جيميناي الرسمية المجانية مباشرة
                const geminiResponse = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: prompt }] }],
                            generationConfig: {
                                temperature: 0.7,
                                maxOutputTokens: 700
                            }
                        }),
                    }
                );

                if (geminiResponse.ok) {
                    const geminiData = await geminiResponse.json();
                    answer = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
                } else {
                    throw new Error(`Gemini Fallback failed with status ${geminiResponse.status}`);
                }
            } catch (geminiError) {
                console.error("All LLM services failed. Relying on local reply.", geminiError);
                answer = generateLocalReply(userData, question);
            }
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
            { status: 500 },
        );
    }
}
