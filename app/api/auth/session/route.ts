import { NextRequest, NextResponse } from "next/server";
import { getConfig, getEnvFromProcess, getSession, sessionCookieOptions } from "@/app/lib/api";




export async function GET(req: NextRequest) {
    try {
        const env = getEnvFromProcess();
        const cfg = getConfig(env);
        const session = await getSession(req, cfg);

        if (!session) {
            const res = NextResponse.json({ authenticated: false }, { status: 401 });
            // Clear stale cookie if present
            const cookieOpts = sessionCookieOptions(cfg);
            res.cookies.set(cookieOpts.name, "", { maxAge: 0, path: "/" });
            return res;
        }

        return NextResponse.json({
            authenticated: true,
            investor: {
                id: session.id,
                investor_id: session.investor_id,
                name: session.name,
                email: session.email,
                investor_type: session.investor_type,
                is_active: session.is_active,
                is_admin: session.is_admin,
            },
        });
    } catch (err) {
        console.error("Session error:", err);
        return NextResponse.json({ authenticated: false }, { status: 401 });
    }
}
