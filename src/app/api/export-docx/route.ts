import { NextRequest, NextResponse } from "next/server";
import { Document, Packer, Paragraph, TextRun } from "docx";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
    try {
        const { text, filename } = await req.json();

        if (!text || typeof text !== "string") {
            return NextResponse.json({ error: "Valid text string is required" }, { status: 400 });
        }

        // Limit to ~2 million characters (approx 2MB) to prevent server RAM exhaustion
        if (text.length > 2000000) {
            return NextResponse.json({ error: "Text payload is too large limit exceeded" }, { status: 413 });
        }

        const doc = new Document({
            creator: "Lingo Handwriting Recognition App",
            title: filename ? filename.replace(/\.docx$/i, "") : "Extracted Document",
            description: "Automated text extraction generated from handwriting and recognized by Lingo application.",
            sections: [
                {
                    properties: {},
                    children: text.split("\n").map((line: string) => {
                        return new Paragraph({
                            children: [new TextRun(line)],
                        });
                    }),
                },
            ],
        });

        // Generate a Buffer on the server side
        const buffer = await Packer.toBuffer(doc);

        return new NextResponse(new Uint8Array(buffer), {
            status: 200,
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "Content-Disposition": `attachment; filename="${filename || "document_extracted.docx"}"`,
            },
        });
    } catch (error) {
        console.error("Error exporting DOCX:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
