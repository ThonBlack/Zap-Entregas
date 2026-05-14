import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
};

export class UploadValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "UploadValidationError";
    }
}

export async function saveFile(file: File): Promise<string> {
    if (file.size > MAX_UPLOAD_BYTES) {
        throw new UploadValidationError("Arquivo maior que 5MB.");
    }
    const ext = ALLOWED_MIME[file.type];
    if (!ext) {
        throw new UploadValidationError("Formato inválido. Use JPG, PNG ou WebP.");
    }

    const uploadDir = path.join(process.cwd(), "uploads");
    try {
        await fs.access(uploadDir);
    } catch {
        await fs.mkdir(uploadDir, { recursive: true });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = `${crypto.randomUUID()}${ext}`;
    const filePath = path.join(uploadDir, fileName);

    await fs.writeFile(filePath, buffer);

    return `/api/uploads/${fileName}`;
}
