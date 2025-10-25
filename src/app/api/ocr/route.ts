import { NextRequest, NextResponse } from "next/server";
import { ImageAnnotatorClient } from "@google-cloud/vision";
import os from "os";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { detectLanguage } from "@/utils/detectLanguage";
import type { OcrResponse } from "@/types/ocr";
import levenshtein from "fast-levenshtein";

interface LanguageToolMatch {
    offset: number;
    length: number;
    message?: string;
    replacements?: { value: string }[];
    rule?: {
        description?: string;
        issueType?: string;
    };
}

function getReason(match: LanguageToolMatch): string {
    if (match.rule?.description) {
        // Use the description directly if available
        return match.rule.description.toLowerCase();
    }
    if (match.rule?.issueType) {
        // Map issueType to user-friendly explanations
        switch (match.rule.issueType.toLowerCase()) {
            case "misspelling":
                return "fixed a common spelling mistake";
            case "grammar":
                return "corrected grammar issue";
            case "style":
                return "improved writing style";
            case "punctuation":
                return "fixed punctuation error";
            case "typography":
                return "corrected typographical issue";
            case "duplication":
                return "removed duplication";
            case "inconsistency":
                return "fixed inconsistency";
            case "internationalization":
                return "corrected internationalization issue";
            case "locale_violation":
                return "fixed locale-specific rule violation";
            case "uncategorized":
                return "corrected general error";
            default:
                return "corrected language issue";
        }
    }
    // Fallback if no rule data
    return "corrected error";
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const visionClient = new ImageAnnotatorClient({
    credentials: {
        client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
});

export async function POST(req: NextRequest) {
    try {
        const form = await req.formData();
        const file = form.get("file") as File | null;
        const fileUrl = form.get("fileUrl") as string | null;

        let tmp: string;

        if (fileUrl) {
            // Fetch from provided URL (signed Firebase Storage URL)
            const response = await fetch(fileUrl);
            if (!response.ok) {
                throw new Error("Failed to fetch file from URL");
            }
            const buffer = Buffer.from(await response.arrayBuffer());
            tmp = path.join(os.tmpdir(), crypto.randomUUID());
            await fs.writeFile(tmp, buffer);
        } else if (file) {
            // Use uploaded file
            tmp = path.join(os.tmpdir(), crypto.randomUUID());
            await fs.writeFile(tmp, Buffer.from(await file.arrayBuffer()));
        } else {
            return NextResponse.json({ error: "No file or fileUrl provided" }, { status: 400 });
        }

        const [result] = await visionClient.textDetection(tmp);
        await fs.unlink(tmp);

        const text = result.fullTextAnnotation?.text || "";
        const language = detectLanguage(text);

        let payload: OcrResponse = { text, language };

        if (language === "English") {
            try {
                // Call LanguageTool API for grammar and spelling correction
                const languagetoolResponse = await fetch("https://api.languagetool.org/v2/check", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                    body: new URLSearchParams({
                        text: text,
                        language: "en-US",
                    }),
                });

                if (languagetoolResponse.ok) {
                    const languagetoolData = await languagetoolResponse.json();

                    // Apply corrections to construct correctedText
                    let correctedText = text;
                    const matches: LanguageToolMatch[] = languagetoolData.matches || [];
                    // Sort matches by offset descending to avoid index shifting
                    matches.sort((a, b) => b.offset - a.offset);
                    for (const match of matches) {
                        if (match.replacements && match.replacements.length > 0) {
                            const start = match.offset;
                            const end = start + match.length;
                            const replacement = match.replacements[0].value;
                            correctedText = correctedText.slice(0, start) + replacement + correctedText.slice(end);
                        }
                    }

                    // Calculate accuracy using Levenshtein distance
                    const distance = levenshtein.get(text, correctedText);
                    const maxLength = Math.max(text.length, correctedText.length);
                    const accuracy = maxLength > 0 ? (1 - distance / maxLength) * 100 : 100;

                    // Extract and clean notes from matches
                    const notes = Array.from(
                        new Set(
                            matches
                                .map((match) => {
                                    if (match.replacements && match.replacements.length > 0) {
                                        const original = text.slice(match.offset, match.offset + match.length);
                                        const corrected = match.replacements[0].value;
                                        const reason = getReason(match);
                                        return `Corrected "${original}" to "${corrected}" → ${reason}`;
                                    }
                                    return match.message || "";
                                })
                                .filter((msg) => msg && msg.trim() !== "")
                        )
                    );

                    payload = {
                        ...payload,
                        correctedText,
                        accuracy: Math.round(accuracy * 100) / 100, // Round to 2 decimal places
                        notes,
                    };
                }
            } catch (error) {
                console.error("LanguageTool API error:", error);
                // Proceed without corrections if API fails
            }
        }

        return NextResponse.json(payload);
    } catch (err) {
        console.error(err);
        const message = err instanceof Error ? err.message : "OCR failed";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
