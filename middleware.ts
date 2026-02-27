import { NextRequest, NextResponse } from "next/server";

const ALLOWED_ORIGINS = [
    "https://dhammacapital.webflow.io",
    "https://dhamma-capital-dashboard.webflow.io",
    "https://www.dhammacapital.in",
    "https://dhammacapital.in",
    "https://www.dcinvestor.in",
    "https://dcinvestor.in",
    "http://localhost:3000",
    "http://localhost:8080",
];

export function middleware(req: NextRequest) {
    const origin = req.headers.get("origin") || "";
    const isAllowed = ALLOWED_ORIGINS.includes(origin) || !origin;

    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        const res = new NextResponse(null, { status: 204 });
        if (isAllowed) {
            res.headers.set("Access-Control-Allow-Origin", origin);
            res.headers.set("Access-Control-Allow-Credentials", "true");
            res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
            res.headers.set("Access-Control-Allow-Headers", "Content-Type");
            res.headers.set("Access-Control-Max-Age", "86400");
        }
        return res;
    }

    const res = NextResponse.next();
    if (isAllowed && origin) {
        res.headers.set("Access-Control-Allow-Origin", origin);
        res.headers.set("Access-Control-Allow-Credentials", "true");
    }
    return res;
}

export const config = {
    matcher: "/api/:path*",
};
