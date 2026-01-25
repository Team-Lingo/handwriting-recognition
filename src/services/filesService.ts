import {
    collection,
    doc,
    getCountFromServer,
    getDocs,
    limit,
    orderBy,
    query,
    runTransaction,
    serverTimestamp,
    setDoc,
    updateDoc,
    DocumentData,
} from "firebase/firestore";
import type { PartialWithFieldValue, UpdateData, WithFieldValue } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { UserFileRecord } from "@/types/file";
import type { OcrResponse } from "@/types/ocr";

type UserOcrStats = {
    analyzedCount: number;
    accuracyCount: number;
    accuracySum: number;
    avgAccuracy: number | null;
    languages: Record<string, number>;
};

type UserDoc = {
    ocrStats?: UserOcrStats;
    ocrStatsUpdatedAt?: unknown;
};

function isFiniteNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
}

function normalizeStats(input: unknown): UserOcrStats {
    const v = (input || {}) as Partial<UserOcrStats>;
    const analyzedCount = isFiniteNumber(v.analyzedCount) ? v.analyzedCount : 0;
    const accuracyCount = isFiniteNumber(v.accuracyCount) ? v.accuracyCount : 0;
    const accuracySum = isFiniteNumber(v.accuracySum) ? v.accuracySum : 0;
    const avgAccuracy = isFiniteNumber(v.avgAccuracy)
        ? v.avgAccuracy
        : accuracyCount > 0
        ? accuracySum / accuracyCount
        : null;
    const languages = (v.languages && typeof v.languages === "object" ? v.languages : {}) as Record<string, number>;
    return { analyzedCount, accuracyCount, accuracySum, avgAccuracy, languages };
}

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

export async function getUserFilesCount(uid: string): Promise<number> {
    const colRef = collection(db, `users/${uid}/files`);
    try {
        const snap = await getCountFromServer(colRef);
        return snap.data().count;
    } catch (error) {
        console.warn("Failed to fetch file count; falling back to listing:", error);
        const items = await listUserFiles(uid, 500);
        return items.length;
    }
}

export async function upsertUserFileRecord(
    uid: string,
    fileId: string,
    payload: Omit<Partial<WithFieldValue<UserFileRecord>>, "fileId">
): Promise<void> {
    const ref = doc(db, `users/${uid}/files/${fileId}`);
    const data: WithFieldValue<UserFileRecord> = {
        ...(payload as WithFieldValue<UserFileRecord>),
        fileId,
        createdAt: payload.createdAt ?? serverTimestamp(),
    };
    await setDoc(ref, data, { merge: true });
}

export async function setUserFileOcrResult(uid: string, fileId: string, ocr: OcrResponse): Promise<void> {
    const fileRef = doc(db, `users/${uid}/files/${fileId}`);
    const userRef = doc(db, `users/${uid}`);

    await runTransaction(db, async (tx) => {
        const [fileSnap, userSnap] = await Promise.all([tx.get(fileRef), tx.get(userRef)]);
        const prevFile = (fileSnap.exists() ? (fileSnap.data() as Partial<UserFileRecord>) : undefined) || undefined;
        const prevStatus = prevFile?.status;
        const prevOcr = prevFile?.ocr;

        const prevLang = prevOcr?.language;
        const nextLang = ocr.language;

        const prevAcc = prevOcr?.accuracy;
        const nextAcc = ocr.accuracy;

        const prevWasAnalyzed = prevStatus === "analyzed";

        const userData = userSnap.exists() ? (userSnap.data() as UserDoc) : undefined;
        const stats = normalizeStats(userData?.ocrStats);
        const nextStats: UserOcrStats = {
            analyzedCount: stats.analyzedCount,
            accuracyCount: stats.accuracyCount,
            accuracySum: stats.accuracySum,
            avgAccuracy: stats.avgAccuracy,
            languages: { ...stats.languages },
        };

        // analyzedCount: only increments the first time the file becomes analyzed.
        if (!prevWasAnalyzed) {
            nextStats.analyzedCount += 1;
        }

        // Language counts: adjust if this is first time or language changed.
        if (prevLang && prevLang !== nextLang) {
            const prevCount = (nextStats.languages[prevLang] || 0) - 1;
            if (prevCount <= 0) delete nextStats.languages[prevLang];
            else nextStats.languages[prevLang] = prevCount;
        }
        if (!prevLang || prevLang !== nextLang) {
            nextStats.languages[nextLang] = (nextStats.languages[nextLang] || 0) + 1;
        }

        // Accuracy: maintain running sum/count for numeric accuracies only.
        const prevHasAcc = isFiniteNumber(prevAcc);
        const nextHasAcc = isFiniteNumber(nextAcc);
        if (prevHasAcc && nextHasAcc) {
            nextStats.accuracySum += (nextAcc as number) - (prevAcc as number);
        } else if (prevHasAcc && !nextHasAcc) {
            nextStats.accuracySum -= prevAcc as number;
            nextStats.accuracyCount = Math.max(0, nextStats.accuracyCount - 1);
        } else if (!prevHasAcc && nextHasAcc) {
            nextStats.accuracySum += nextAcc as number;
            nextStats.accuracyCount += 1;
        }
        nextStats.avgAccuracy = nextStats.accuracyCount > 0 ? nextStats.accuracySum / nextStats.accuracyCount : null;

        // Update file doc.
        const fileUpdate: PartialWithFieldValue<UserFileRecord> = {
            status: "analyzed",
            ocr,
            ocrLanguage: ocr.language || null,
            ocrAccuracy: isFiniteNumber(ocr.accuracy) ? ocr.accuracy : null,
            analyzedAt: serverTimestamp(),
        };
        tx.set(fileRef, fileUpdate, { merge: true });

        // Update user aggregated stats.
        const userUpdate: PartialWithFieldValue<UserDoc> = {
            ocrStats: {
                analyzedCount: nextStats.analyzedCount,
                accuracyCount: nextStats.accuracyCount,
                accuracySum: nextStats.accuracySum,
                avgAccuracy: nextStats.avgAccuracy,
                languages: nextStats.languages,
            },
            ocrStatsUpdatedAt: serverTimestamp(),
        };
        tx.set(userRef, userUpdate, { merge: true });
    });
}

export async function setUserFileFailed(uid: string, fileId: string, errorMessage?: string): Promise<void> {
    const ref = doc(db, `users/${uid}/files/${fileId}`);
    const data: UpdateData<UserFileRecord> = {
        status: "failed",
        analyzedAt: serverTimestamp(),
        errorMessage: errorMessage || null,
    };
    await updateDoc(ref, data);
}
