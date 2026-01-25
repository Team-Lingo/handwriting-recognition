import { Timestamp } from "firebase/firestore";
import type { OcrResponse } from "@/types/ocr";

export interface UserFileRecord {
    fileId: string;
    name: string;
    storagePath: string;
    bucket: string;
    contentType: string | null;
    size: number | null;
    category?: string | null;
    md5Hash?: string | null;
    crc32c?: string | null;
    timeCreated?: string | null;
    updated?: string | null;
    status: "uploaded" | "analyzed" | "failed";
    createdAt?: Timestamp;
    analyzedAt?: Timestamp;
    ocr?: OcrResponse;
    ocrLanguage?: string | null;
    ocrAccuracy?: number | null;
    errorMessage?: string | null;
}
