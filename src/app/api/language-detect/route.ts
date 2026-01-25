import { NextRequest, NextResponse } from "next/server";
import { ImageAnnotatorClient } from "@google-cloud/vision";
import { detectLanguage } from "@/utils/detectLanguage";

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

        let buffer: Buffer;
        let contentType: string | null = null;

        if (fileUrl) {
            const response = await fetch(fileUrl);
            if (!response.ok) throw new Error("Failed to fetch file from URL");
            buffer = Buffer.from(await response.arrayBuffer());
            contentType = response.headers.get("content-type");
        } else if (file) {
            buffer = Buffer.from(await file.arrayBuffer());
            contentType = file.type || null;
        } else {
            return NextResponse.json({ error: "No file or fileUrl provided" }, { status: 400 });
        }

        if (!contentType || !contentType.toLowerCase().startsWith("image/")) {
            return NextResponse.json(
                { error: "Only image uploads are supported for language detection" },
                { status: 400 },
            );
        }

        const [result] = await visionClient.textDetection(buffer);
        const text = result.fullTextAnnotation?.text || "";
        const language = detectLanguage(text);

        return NextResponse.json({
            language,
            hasText: Boolean(text.trim()),
        });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: (err as Error).message || "Language detection failed" }, { status: 500 });
    }
}
