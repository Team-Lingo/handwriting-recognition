import { collection, getDocs, orderBy, query, limit, DocumentData } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { UserFileRecord } from "@/types/file";

export async function listUserFiles(uid: string, max: number = 50): Promise<UserFileRecord[]> {
    const colRef = collection(db, `users/${uid}/files`);
    try {
        const q = query(colRef, orderBy("createdAt", "desc"), limit(max));
        const snap = await getDocs(q);
        return snap.docs.map((d) => ({ fileId: d.id, ...(d.data() as DocumentData) })) as UserFileRecord[];
    } catch (error) {
        console.warn("Fetching files without ordering (index may not exist yet):", error);
        const q = query(colRef, limit(max));
        const snap = await getDocs(q);
        const files = snap.docs.map((d) => ({ fileId: d.id, ...(d.data() as DocumentData) })) as UserFileRecord[];
        return files.sort((a, b) => {
            const aTime = a.createdAt?.toMillis?.() || 0;
            const bTime = b.createdAt?.toMillis?.() || 0;
            return bTime - aTime;
        });
    }
}
