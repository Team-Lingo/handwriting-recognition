/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { ImageAnnotatorClient } from "@google-cloud/vision";
import os from "os";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { detectLanguage } from "@/utils/detectLanguage";
import type { OcrResponse } from "@/types/ocr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // no ISR caching

// Single client reused across requests
const visionClient = new ImageAnnotatorClient();

export async function POST(req: NextRequest) {
    try {
        /* 1 ─── pull the uploaded file from <multipart/form-data> */
        const form = await req.formData();
        const file = form.get("file") as File | null;
        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        /* 2 ─── write to a temp file so Vision can read it */
        const tmp = path.join(os.tmpdir(), crypto.randomUUID());
        await fs.writeFile(tmp, Buffer.from(await file.arrayBuffer()));

        /* 3 ─── call Google Cloud Vision OCR */
        const [result] = await visionClient.textDetection(tmp);
        await fs.unlink(tmp); // clean-up

        const text = result.fullTextAnnotation?.text || "";
        const language = detectLanguage(text);

        const payload: OcrResponse = { text, language };
        return NextResponse.json(payload);
    } catch (err: any) {
        console.error(err);
        return NextResponse.json({ error: err.message ?? "OCR failed" }, { status: 500 });
    }
}
