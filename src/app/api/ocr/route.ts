import { NextRequest, NextResponse } from "next/server";
import { ImageAnnotatorClient } from "@google-cloud/vision";
import os from "os";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { detectLanguage } from "@/utils/detectLanguage";
import type { OcrResponse } from "@/types/ocr";

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
        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }
        const tmp = path.join(os.tmpdir(), crypto.randomUUID());
        await fs.writeFile(tmp, Buffer.from(await file.arrayBuffer()));

        const [result] = await visionClient.textDetection(tmp);
        await fs.unlink(tmp);

        const text = result.fullTextAnnotation?.text || "";
        const language = detectLanguage(text);

        const payload: OcrResponse = { text, language };
        return NextResponse.json(payload);
    } catch (err) {
        console.error(err);
        const message = err instanceof Error ? err.message : "OCR failed";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
