import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

// Handler para pre-flight requests (mobile browsers)
export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            "Access-Control-Allow-Origin": process.env.CORS_ORIGIN || "http://localhost:3000",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Max-Age": "86400"
        }
    });
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ filename: string }> }
) {
    const rawFilename = (await params).filename;

    // SECURITY: Sanitizar filename para prevenir Path Traversal
    const filename = path.basename(rawFilename);
    const uploadsDir = path.resolve(process.cwd(), "uploads");
    const filePath = path.join(uploadsDir, filename);

    // SECURITY: Validar que o caminho final está dentro de uploads
    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(uploadsDir + path.sep)) {
        console.error(`[UPLOAD] Path Traversal attempt blocked: ${rawFilename}`);
        return new NextResponse("Forbidden", { status: 403 });
    }

    try {
        const fileBuffer = await fs.readFile(filePath);
        const stats = await fs.stat(filePath);

        const ext = path.extname(filename).toLowerCase();
        let contentType = "application/octet-stream";
        if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg";
        if (ext === ".png") contentType = "image/png";
        if (ext === ".webp") contentType = "image/webp";
        if (ext === ".gif") contentType = "image/gif";

        const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:3000";

        return new NextResponse(fileBuffer, {
            headers: {
                "Content-Type": contentType,
                "Content-Length": String(stats.size),
                "Cache-Control": "public, max-age=31536000, immutable",
                "Access-Control-Allow-Origin": corsOrigin,
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Expose-Headers": "Content-Length, Content-Type",
                "Cross-Origin-Resource-Policy": "cross-origin",
                "Accept-Ranges": "bytes",
                "Vary": "Accept-Encoding",
                "X-Content-Type-Options": "nosniff"
            }
        });
    } catch (e) {
        console.error(`[UPLOAD] File not found: ${filePath}`);
        return new NextResponse("File not found", { status: 404 });
    }
}
