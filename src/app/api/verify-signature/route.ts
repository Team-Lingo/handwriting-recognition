import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SIGNATURE_ENDPOINT =
    process.env.SIGNATURE_VERIFY_URL ||
    "https://us-central1-lingo-handwriting-recognition.cloudfunctions.net/verify_signature";

export async function POST(req: NextRequest) {
    try {
        const form = await req.formData();
        const reference = form.get("reference") as File | null;
        const test = form.get("test") as File | null;

        if (!reference || !test) {
            return NextResponse.json({ error: "Both reference and test images are required" }, { status: 400 });
        }

        const upstream = new FormData();
        upstream.append("reference", reference, reference.name || "reference.png");
        upstream.append("test", test, test.name || "test.png");

        const res = await fetch(SIGNATURE_ENDPOINT, { method: "POST", body: upstream });
        const text = await res.text();

        if (!res.ok) {
            return NextResponse.json(
                { error: `Signature service error (${res.status}): ${text}` },
                { status: res.status },
            );
        }

        const data = JSON.parse(text) as { similarity: number; is_genuine: boolean };
        return NextResponse.json(data);
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: (err as Error).message || "Signature verification failed" }, { status: 500 });
    }
}
