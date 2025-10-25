import { onObjectFinalized } from "firebase-functions/v2/storage";
import * as logger from "firebase-functions/logger";
import { admin, db } from "./admin";

export const onUserFileUploaded = onObjectFinalized(async (event) => {
    const obj = event.data;
    const fullPath = obj.name || "";
    if (!fullPath) return;

    const match = fullPath.match(/^users\/([^/]+)\/files\/([^/]+)$/);
    if (!match) {
        logger.debug("Ignoring object outside users/{uid}/files/*", { fullPath });
        return;
    }

    const uid = match[1];
    const basename = match[2];
    const fileId = basename.includes(".") ? basename.substring(0, basename.lastIndexOf(".")) : basename;

    const fileDocRef = db.doc(`users/${uid}/files/${fileId}`);
    const payload = {
        fileId,
        name: basename,
        storagePath: fullPath,
        bucket: obj.bucket,
        contentType: obj.contentType || null,
        size: obj.size ? Number(obj.size) : null,
        md5Hash: obj.md5Hash || null,
        crc32c: obj.crc32c || null,
        timeCreated: obj.timeCreated || null,
        updated: obj.updated || null,
        status: "uploaded" as const,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await fileDocRef.set(payload, { merge: true });
    logger.info("Created/updated Firestore file document", { uid, fileId, path: fullPath });
});
