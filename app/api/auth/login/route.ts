import { NextRequest, NextResponse } from "next/server";
import { getConfig, getEnvFromProcess, listCollectionItems, extractInvestorDisplay, extractPassword, safeLower, sanitizeText, buildSessionToken, sessionCookieOptions, isRateLimited, registerFailedAttempt, clearFailedAttempts } from "@/app/lib/api";




export async function POST(req: NextRequest) {
    try {
        const env = getEnvFromProcess();
        const kv: KVNamespace = {
            get: async () => null,
            put: async () => { },
            delete: async () => { },
            list: async () => ({ keys: [], list_complete: true, cacheStatus: null }),
            getWithMetadata: async () => ({ value: null, metadata: null, cacheStatus: null }),
        } as unknown as KVNamespace;

        const cfg = getConfig(env);
        const body = (await req.json()) as { email?: string; password?: string; investorType?: string };
        const { email, password, investorType } = body;

        const normalizedEmail = safeLower(email);
        const normalizedPassword = sanitizeText(password);
        const requestedType = safeLower(investorType || "any");

        if (!normalizedEmail || !normalizedPassword) {
            return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
        }

        const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "unknown";

        if (await isRateLimited(kv, ip, normalizedEmail, cfg)) {
            return NextResponse.json({ error: "Too many failed attempts. Try again later." }, { status: 429 });
        }

        const investors = await listCollectionItems(cfg.investorsCollectionId, cfg);
        const item = investors.find((c) => safeLower((c.fieldData as Record<string, unknown>).email) === normalizedEmail);

        if (!item) {
            await registerFailedAttempt(kv, ip, normalizedEmail, cfg);
            return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
        }

        const investor = extractInvestorDisplay(item as { id: string; fieldData: Record<string, unknown> }, cfg);
        const storedPassword = extractPassword(item.fieldData as Record<string, unknown>);

        if (requestedType !== "any" && requestedType !== investor.investor_type) {
            await registerFailedAttempt(kv, ip, normalizedEmail, cfg);
            return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
        }

        if (!investor.is_active) {
            return NextResponse.json({ error: "Account inactive. Contact admin." }, { status: 403 });
        }

        if (!storedPassword || storedPassword !== normalizedPassword) {
            await registerFailedAttempt(kv, ip, normalizedEmail, cfg);
            return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
        }

        await clearFailedAttempts(kv, ip, normalizedEmail);

        const token = await buildSessionToken(
            {
                id: investor.id,
                investor_id: investor.investor_id,
                name: investor.name,
                email: investor.email,
                investor_type: investor.investor_type,
                is_active: investor.is_active,
                is_admin: investor.is_admin,
                ref_ids: [investor.id, investor.investor_id],
            },
            cfg
        );

        const res = NextResponse.json({ authenticated: true, investor, token, expiresInHours: cfg.sessionHours });
        const cookieOpts = sessionCookieOptions(cfg);
        res.cookies.set(cookieOpts.name, token, {
            httpOnly: cookieOpts.httpOnly,
            secure: cookieOpts.secure,
            sameSite: cookieOpts.sameSite,
            maxAge: cookieOpts.maxAge,
            path: cookieOpts.path,
        });
        return res;
    } catch (err) {
        console.error("Login error:", err);
        return NextResponse.json({ error: "Failed to login" }, { status: 500 });
    }
}
