import { NextRequest, NextResponse } from "next/server";
import { getSession, getConfig, getEnvFromProcess, safeLower } from "@/app/lib/api";

function formatBytes(bytes: number, decimals = 1) {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

const ALLOWED_DOMAINS = [
    ".webflow.com",
    ".website-files.com",
    ".amazonaws.com",
    "storage.googleapis.com"
];

function isUrlAllowed(urlStr: string): boolean {
    try {
        const u = new URL(urlStr);
        if (u.protocol !== "https:") return false;
        const host = safeLower(u.hostname);
        return ALLOWED_DOMAINS.some(d => host.endsWith(d));
    } catch {
        return false;
    }
}

export async function GET(req: NextRequest) {
    try {
        const env = getEnvFromProcess();
        const cfg = getConfig(env);
        const session = await getSession(req, cfg);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const targetUrl = searchParams.get("url");
        const action = searchParams.get("action");
        const filename = searchParams.get("filename") || "document";

        if (!targetUrl || !isUrlAllowed(targetUrl)) {
            return NextResponse.json({ error: "Invalid or unsupported URL" }, { status: 400 });
        }

        if (action === "size") {
            const res = await fetch(targetUrl, { method: "HEAD" });
            const sizeRaw = res.headers.get("content-length");
            const sizeNum = parseInt(sizeRaw || "0", 10);
            return NextResponse.json({
                size_bytes: sizeNum,
                size_label: formatBytes(sizeNum)
            });
        }

        if (action === "download") {
            const res = await fetch(targetUrl);
            if (!res.ok) throw new Error("Failed to fetch remote file");

            const headers = new Headers(res.headers);
            const ct = res.headers.get("content-type") || "";

            // Re-construct extension if missing
            let ext = "";
            if (ct.includes("pdf")) ext = ".pdf";
            else if (ct.includes("document")) ext = ".docx";
            else if (ct.includes("excel") || ct.includes("spreadsheet")) ext = ".xlsx";
            else if (ct.includes("png")) ext = ".png";
            else if (ct.includes("jpeg")) ext = ".jpg";

            const finalName = filename.toLowerCase().endsWith(ext) ? filename : `${filename}${ext}`;

            headers.set("Content-Disposition", `attachment; filename="${finalName}"`);
            headers.delete("access-control-allow-origin");

            return new NextResponse(res.body, {
                status: 200,
                headers
            });
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });

    } catch (err) {
        console.error("Proxy error:", err);
        return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
    }
}
