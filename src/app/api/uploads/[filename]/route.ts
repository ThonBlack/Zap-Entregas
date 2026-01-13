import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ filename: string }> }
) {
    const filename = (await params).filename;
    const filePath = path.join(process.cwd(), "uploads", filename);

    try {
        const fileBuffer = await fs.readFile(filePath);

        const ext = path.extname(filename).toLowerCase();
        let contentType = "application/octet-stream";
        if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg";
        if (ext === ".png") contentType = "image/png";
        if (ext === ".webp") contentType = "image/webp";
        if (ext === ".gif") contentType = "image/gif";

        return new NextResponse(fileBuffer, {
            headers: {
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=31536000, immutable",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Cross-Origin-Resource-Policy": "cross-origin"
            }
        });
    } catch (e) {
        return new NextResponse("File not found", { status: 404 });
    }
}
