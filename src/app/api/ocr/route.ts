import { NextRequest, NextResponse } from "next/server";
import { ImageAnnotatorClient } from "@google-cloud/vision";
import os from "os";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { detectLanguage } from "@/utils/detectLanguage";
import levenshtein from "fast-levenshtein";
import JSZip from "jszip";
import mammoth from "mammoth";
import * as XLSX from "xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

if (!process.env.GOOGLE_CLOUD_CLIENT_EMAIL || !process.env.GOOGLE_CLOUD_PRIVATE_KEY) {
    console.warn("Google Vision credentials missing");
}

const visionClient = new ImageAnnotatorClient({
    credentials: {
        client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL!,
        private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, "\n")!,
    },
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
});

const tmpBase = path.join(os.tmpdir(), "handwriting-recognition");
const dataFile = path.join(tmpBase, "ocrData.json");

const globalCache = globalThis as typeof globalThis & {
    ocrMemoryDb?: Record<string, OcrResponse>;
};

if (!globalCache.ocrMemoryDb) {
    globalCache.ocrMemoryDb = {};
}

async function ensureTmpDir() {
    await fs.mkdir(tmpBase, { recursive: true }).catch(() => {});
}

async function readDataStore(): Promise<Record<string, OcrResponse>> {
    let fileData: Record<string, OcrResponse> = {};

    try {
        const raw = await fs.readFile(dataFile, "utf8");
        fileData = JSON.parse(raw);
    } catch {}

    return {
        ...(globalCache.ocrMemoryDb || {}),
        ...fileData,
    };
}

async function writeDataStore(data: Record<string, OcrResponse>) {
    const keys = Object.keys(data);

    if (keys.length > 1000) {
        delete data[keys[0]];
    }

    globalCache.ocrMemoryDb = data;

    try {
        await fs.writeFile(dataFile, JSON.stringify(data, null, 2), "utf8");
    } catch {}
}

type FileKind = "image" | "pdf" | "pptx" | "docx" | "xlsx";

function inferFileKind(contentType: string | null | undefined, filename: string | null | undefined): FileKind {
    const name = (filename || "").toLowerCase();
    const ct = (contentType || "").toLowerCase();

    if (ct.startsWith("image/")) return "image";
    if (ct === "application/pdf" || name.endsWith(".pdf")) return "pdf";
    if (name.endsWith(".pptx")) return "pptx";
    if (name.endsWith(".docx")) return "docx";
    if (name.endsWith(".xlsx") || name.endsWith(".xls")) return "xlsx";

    return "image";
}

function decodeXmlEntities(text: string) {
    return text
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
}

async function extractPptxText(buffer: Buffer) {
    const zip = await JSZip.loadAsync(buffer);
    const slides = Object.keys(zip.files).filter((x) => x.match(/^ppt\/slides\/slide\d+\.xml$/));

    let result: string[] = [];

    for (const slide of slides) {
        const xml = await zip.file(slide)!.async("string");
        const matches = [...xml.matchAll(/<a:t[^>]*>(.*?)<\/a:t>/g)];
        result.push(matches.map((x) => decodeXmlEntities(x[1])).join(" "));
    }

    return result.join("\n\n").trim();
}

async function extractExcelText(buffer: Buffer) {
    const wb = XLSX.read(buffer, { type: "buffer" });
    let result: string[] = [];

    for (const sheet of wb.SheetNames) {
        const ws = wb.Sheets[sheet];
        const text = XLSX.utils.sheet_to_csv(ws);

        if (text.trim()) result.push(`--- ${sheet} ---\n${text}`);
    }

    return result.join("\n\n");
}

function getReason(match: LanguageToolMatch) {
    if (match.rule?.description) return match.rule.description;
    return "corrected language issue";
}

function generateLocalReply(data: OcrResponse, question: string) {
    return `سؤالك: ${question}. \nالتحليل:\n${data.notes?.join(";") || "لا توجد ملاحظات"}\nالدقة:\n${data.accuracy ?? "غير معروفة"}%`;
}

// =================== POST METHOD ===================
export async function POST(req: NextRequest) {
    try {
        const form = await req.formData();
        const file = form.get("file") as File | null;
        const fileUrl = form.get("fileUrl") as string | null;

        await ensureTmpDir();

        let buffer: Buffer;
        let filename = "";
        let contentType = "";

        if (fileUrl) {
            const u = new URL(fileUrl);
            if (!["http:", "https:"].includes(u.protocol)) throw new Error("Invalid URL");

            const res = await fetch(fileUrl);
            if (!res.ok) throw new Error("Download failed");

            buffer = Buffer.from(await res.arrayBuffer());
            contentType = res.headers.get("content-type") || "";
            filename = u.pathname.split("/").pop() || "";
        } else if (file) {
            buffer = Buffer.from(await file.arrayBuffer());
            filename = file.name;
            contentType = file.type;
        } else {
            return NextResponse.json({ error: "No file" }, { status: 400 });
        }

        if (buffer.length > 20 * 1024 * 1024) throw new Error("File too large");

        const kind = inferFileKind(contentType, filename);
        let text = "";

        if (kind === "pdf") {
            const pdf = (await import("pdf-parse")).default;
            const data = await pdf(buffer);
            text = data.text || "";
        } else if (kind === "pptx") {
            text = await extractPptxText(buffer);
        } else if (kind === "docx") {
            const r = await mammoth.extractRawText({ buffer });
            text = r.value || "";
        } else if (kind === "xlsx") {
            text = await extractExcelText(buffer);
        } else {
            const [result] = await visionClient.textDetection(buffer);
            text = result.fullTextAnnotation?.text || "";
        }

        const language = detectLanguage(text);

        let payload: OcrResponse = {
            text,
            language,
            history: [],
        };

        if (text) {
            try {
                let lang = "en-US";

                if (language === "Arabic" || language === "ar")
                    lang = "ar";
                else if (language === "French" || language === "fr")
                    lang = "fr";
                else if (language === "German" || language === "de")
                    lang = "de";
                else if (language === "Spanish" || language === "es")
                    lang = "es";

                const lt = await fetch("https://api.languagetool.org/v2/check", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                    body: new URLSearchParams({
                        text,
                        language: lang,
                    }),
                });

                if (lt.ok) {
                    const data = await lt.json();
                    let corrected = text;
                    const matches = data.matches || [];

                    matches.sort((a: any, b: any) => b.offset - a.offset);

                    for (const m of matches) {
                        if (m.replacements?.length) {
                            corrected =
                                corrected.slice(0, m.offset) +
                                m.replacements[0].value +
                                corrected.slice(m.offset + m.length);
                        }
                    }

                    const distance = levenshtein.get(text, corrected);
                    const accuracy = 100 - (distance / Math.max(text.length, corrected.length)) * 100;

                    payload.correctedText = corrected;
                    payload.accuracy = Math.round(accuracy * 100) / 100;
                    payload.notes = matches.map((m: any) => getReason(m));
                }
            } catch {}
        }

        const db = await readDataStore();

        // التعديل المطلوب: تم تحديث الـ key ليعتمد على الـ text فقط
        const key = crypto
            .createHash("md5")
            .update(text)
            .digest("hex");

        db[key] = payload;
        await writeDataStore(db);

        return NextResponse.json({
            key,
            ...payload,
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// =================== GET METHOD ===================
export async function GET(req: NextRequest) {
    try {
        await ensureTmpDir();

        const key = req.nextUrl.searchParams.get("key");
        const question = req.nextUrl.searchParams.get("question") || "";

        if (!key) {
            return NextResponse.json({ error: "No key provided" }, { status: 400 });
        }

        const db = await readDataStore();
        const userData = db[key];

        if (!userData) {
            return NextResponse.json({ error: "No data found" }, { status: 404 });
        }

        // ================= Simple Replies =================
        const simpleResponses: Record<string, string> = {
            "شكرا لك": "على الرحب والسعة! 😊",
            "شكراً لك": "على الرحب والسعة! 😊",
            "thank you": "You're welcome! 😊",
            thanks: "You're welcome! 😊",
            hi: "Hello! How can I help you today? 🙂",
            مرحبا: "أهلاً! كيف يمكنني مساعدتك اليوم؟ 🙂",
        };

        const lower = question.trim().toLowerCase();

        if (simpleResponses[lower]) {
            userData.history = userData.history || [];
            userData.history.push({
                question,
                answer: simpleResponses[lower],
            });

            db[key] = userData;
            await writeDataStore(db);

            return NextResponse.json({
                answer: simpleResponses[lower],
            });
        }

        // ================= Prompt =================
        const lang = /[ء-ي]/.test(question) ? "Arabic" : "English";

        const history =
            userData.history
                ?.map(
                    (h) => `User:${h.question}
Assistant:${h.answer}`
                )
                .join("\n") || "";

        const prompt = `
You are an intelligent AI assistant.

OCR Text:
${userData.correctedText || userData.text}


Accuracy:
${userData.accuracy ?? "unknown"}%


Notes:
${userData.notes?.join(";") || "none"}


History:
${history}


Question:
${question}


Answer in ${lang}.
`;

        let answer = "";
        let fallback = false;

        // ================= OpenRouter =================
        try {
            const openRouterKey = process.env.OPENROUTER_API_KEY;

            if (!openRouterKey) throw new Error("Missing OpenRouter key");

            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${openRouterKey}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "",
                    "X-Title": "OCR Assistant",
                },
                body: JSON.stringify({
                    model: process.env.OPENROUTER_MODEL || "meta-llama/llama-3.1-8b-instruct",
                    messages: [
                        {
                            role: "user",
                            content: prompt,
                        },
                    ],
                    temperature: 0.7,
                    max_tokens: 700,
                }),
            });

            if (!response.ok) throw new Error("OpenRouter failed");

            const data = await response.json();
            answer = data.choices?.[0]?.message?.content || "";
        } catch (e) {
            fallback = true;
        }

        // ================= Gemini Fallback =================
        if (fallback || !answer) {
            try {
                const geminiKey = process.env.GEMINI_API_KEY;

                if (!geminiKey) throw new Error("Missing Gemini key");

                const response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            contents: [
                                {
                                    parts: [
                                        {
                                            text: prompt,
                                        },
                                    ],
                                },
                            ],
                            generationConfig: {
                                temperature: 0.7,
                                maxOutputTokens: 700,
                            },
                        }),
                    }
                );

                if (!response.ok) throw new Error("Gemini failed");

                const data = await response.json();
                answer = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
            } catch (e) {
                answer = generateLocalReply(userData, question);
            }
        }

        // ================= Save History =================
        userData.history = userData.history || [];
        userData.history.push({
            question,
            answer,
        });

        db[key] = userData;
        await writeDataStore(db);

        return NextResponse.json({
            answer,
        });
    } catch (e: any) {
        return NextResponse.json(
            {
                error: "Failed to fetch answer",
                details: e.message,
            },
            {
                status: 500,
            }
        );
    }
}
