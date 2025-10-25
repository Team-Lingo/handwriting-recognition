import { collection, getDocs, orderBy, query, limit, DocumentData } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { UserFileRecord } from "@/types/file";

export async function listUserFiles(uid: string, max: number = 50): Promise<UserFileRecord[]> {
    const colRef = collection(db, `users/${uid}/files`);
    const q = query(colRef, orderBy("createdAt", "desc"), limit(max));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ fileId: d.id, ...(d.data() as DocumentData) })) as UserFileRecord[];
}
