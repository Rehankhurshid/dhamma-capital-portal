import { NextRequest, NextResponse } from "next/server";
import {
    buildResetPasswordToken,
    extractInvestorDisplay,
    getConfig,
    getEnvFromProcess,
    listCollectionItems,
    safeLower,
} from "@/app/lib/api";

const GENERIC_SUCCESS_MESSAGE = "If an account exists for that email, a reset link has been sent.";

function getResetBaseUrl(req: NextRequest, env: CloudflareEnv): string {
    const explicit = String(env.RESET_PASSWORD_BASE_URL || "").trim();
    if (explicit) return explicit.replace(/\/$/, "");
    const origin = req.nextUrl.origin || "";
    return origin.replace(/\/$/, "");
}

async function sendResetEmail(to: string, resetUrl: string, env: CloudflareEnv) {
    const apiKey = String(env.RESEND_API_KEY || "").trim();
    const from = String(env.RESET_PASSWORD_FROM_EMAIL || "").trim();

    if (!apiKey || !from) {
        throw new Error("Password reset email is not configured");
    }

    const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            from,
            to: [to],
            subject: "Reset your Dhamma Capital portal password",
            html: `
                <div style="font-family:Arial,sans-serif;color:#17365d;line-height:1.6;">
                    <h2 style="margin:0 0 16px;">Reset your password</h2>
                    <p style="margin:0 0 12px;">A password reset was requested for the Dhamma Capital investor portal.</p>
                    <p style="margin:0 0 20px;">Use the button below to set a new password. This link expires in 30 minutes.</p>
                    <p style="margin:0 0 24px;">
                        <a href="${resetUrl}" style="display:inline-block;padding:12px 18px;background:#0b4a6f;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">
                            Reset Password
                        </a>
                    </p>
                    <p style="margin:0 0 8px;">If the button does not work, use this link:</p>
                    <p style="margin:0;word-break:break-all;"><a href="${resetUrl}">${resetUrl}</a></p>
                </div>
            `,
        }),
    });

    if (!response.ok) {
        const body = await response.text();
        throw new Error(`Failed to send reset email: ${body}`);
    }
}

export async function POST(req: NextRequest) {
    try {
        const env = getEnvFromProcess();
        const cfg = getConfig(env);
        const body = (await req.json()) as { email?: string };
        const normalizedEmail = safeLower(body.email);

        if (!normalizedEmail) {
            return NextResponse.json({ error: "Email is required" }, { status: 400 });
        }

        const investors = await listCollectionItems(cfg.investorsCollectionId, cfg);
        const item = investors.find((candidate) =>
            safeLower((candidate.fieldData as Record<string, unknown>).email) === normalizedEmail
        );

        if (!item) {
            return NextResponse.json({ ok: true, message: GENERIC_SUCCESS_MESSAGE });
        }

        const investor = extractInvestorDisplay(item as { id: string; fieldData: Record<string, unknown> }, cfg);
        if (!investor.is_active) {
            return NextResponse.json({ ok: true, message: GENERIC_SUCCESS_MESSAGE });
        }

        const token = await buildResetPasswordToken(
            {
                investorId: investor.id,
                email: investor.email,
            },
            cfg
        );
        const resetBaseUrl = getResetBaseUrl(req, env);
        const resetUrl = `${resetBaseUrl}/reset-password?token=${encodeURIComponent(token)}`;

        await sendResetEmail(investor.email, resetUrl, env);

        return NextResponse.json({ ok: true, message: GENERIC_SUCCESS_MESSAGE });
    } catch (err) {
        console.error("Forgot password error:", err);
        return NextResponse.json(
            { error: "Password reset is unavailable right now. Please contact support." },
            { status: 503 }
        );
    }
}
