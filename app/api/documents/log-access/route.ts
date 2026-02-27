import { NextRequest, NextResponse } from "next/server";
import { getConfig, getEnvFromProcess, getSession, createCollectionItem, sanitizeText } from "@/app/lib/api";




export async function POST(req: NextRequest) {
    try {
        const env = getEnvFromProcess();
        const cfg = getConfig(env);
        const session = await getSession(req, cfg);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = (await req.json()) as { documentId?: string; documentTitle?: string; action?: string };

        const logRecord = {
            document_id: sanitizeText(body.documentId),
            document_title: sanitizeText(body.documentTitle),
            investor_id: sanitizeText(session.investor_id),
            investor_email: sanitizeText(session.email),
            action: sanitizeText(body.action || "download"),
            timestamp: new Date().toISOString(),
            user_agent: sanitizeText(req.headers.get("user-agent") || ""),
            ip_address: sanitizeText(req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "unknown"),
        };

        if (cfg.accessLogsCollectionId) {
            await createCollectionItem(cfg.accessLogsCollectionId, logRecord, cfg);
        } else {
            console.log("[DOCUMENT_ACCESS_LOG]", logRecord);
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("Log access error:", err);
        return NextResponse.json({ error: "Failed to log access" }, { status: 500 });
    }
}
