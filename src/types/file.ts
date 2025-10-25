import { Timestamp } from "firebase/firestore";

export interface UserFileRecord {
    fileId: string;
    name: string;
    storagePath: string;
    bucket: string;
    contentType: string | null;
    size: number | null;
    md5Hash?: string | null;
    crc32c?: string | null;
    timeCreated?: string | null;
    updated?: string | null;
    status: "uploaded" | "analyzed" | "failed";
    createdAt?: Timestamp;
}
