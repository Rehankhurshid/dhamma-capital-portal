import { NextRequest, NextResponse } from "next/server";
import {
    extractInvestorDisplay,
    getConfig,
    getEnvFromProcess,
    listCollectionItems,
    patchCollectionItem,
    safeLower,
    sanitizeText,
    verifyResetPasswordToken,
} from "@/app/lib/api";

function validatePassword(password: string): string {
    if (password.length < 8) return "Password must be at least 8 characters.";
    return "";
}

export async function POST(req: NextRequest) {
    try {
        const env = getEnvFromProcess();
        const cfg = getConfig(env);
        const body = (await req.json()) as { token?: string; password?: string; confirmPassword?: string };

        const token = sanitizeText(body.token);
        const password = sanitizeText(body.password);
        const confirmPassword = sanitizeText(body.confirmPassword);

        if (!token || !password || !confirmPassword) {
            return NextResponse.json({ error: "Token and password are required." }, { status: 400 });
        }
        if (password !== confirmPassword) {
            return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
        }

        const validationError = validatePassword(password);
        if (validationError) {
            return NextResponse.json({ error: validationError }, { status: 400 });
        }

        const resetPayload = await verifyResetPasswordToken(token, cfg);

        const investors = await listCollectionItems(cfg.investorsCollectionId, cfg);
        const item = investors.find((candidate) => candidate.id === resetPayload.investorId);
        if (!item) {
            return NextResponse.json({ error: "Reset link is invalid or expired." }, { status: 400 });
        }

        const investor = extractInvestorDisplay(item as { id: string; fieldData: Record<string, unknown> }, cfg);
        if (safeLower(investor.email) !== safeLower(resetPayload.email)) {
            return NextResponse.json({ error: "Reset link is invalid or expired." }, { status: 400 });
        }

        await patchCollectionItem(
            cfg.investorsCollectionId,
            item.id,
            {
                password,
            },
            cfg
        );

        return NextResponse.json({ ok: true, message: "Password updated successfully." });
    } catch (err) {
        console.error("Reset password error:", err);
        return NextResponse.json({ error: "Reset link is invalid or expired." }, { status: 400 });
    }
}
