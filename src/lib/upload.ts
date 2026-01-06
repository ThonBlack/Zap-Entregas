import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export async function saveFile(file: File): Promise<string> {
    const uploadDir = path.join(process.cwd(), "uploads");

    // Ensure upload dir exists
    try {
        await fs.access(uploadDir);
    } catch {
        await fs.mkdir(uploadDir, { recursive: true });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Create unique name
    const ext = path.extname(file.name) || ".jpg";
    const fileName = `${crypto.randomUUID()}${ext}`;
    const filePath = path.join(uploadDir, fileName);

    await fs.writeFile(filePath, buffer);

    return `/api/uploads/${fileName}`;
}
