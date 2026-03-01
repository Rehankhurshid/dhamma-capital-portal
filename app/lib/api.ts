import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

// ─── Config helpers ──────────────────────────────────────────────────────────

export function getConfig(env?: CloudflareEnv) {
    const e = env ?? ({} as CloudflareEnv);
    return {
        webflowToken: e.WEBFLOW_CMS_SITE_API_TOKEN || "",
        webflowHost: (e.WEBFLOW_API_HOST || "https://api.webflow.com/v2").replace(/\/$/, ""),
        webflowUseLive: String(e.WEBFLOW_USE_LIVE || "true").toLowerCase() !== "false",
        investorsCollectionId: e.WEBFLOW_INVESTORS_COLLECTION_ID || "",
        documentsCollectionId: e.WEBFLOW_DOCUMENTS_COLLECTION_ID || "",
        accessLogsCollectionId: e.WEBFLOW_ACCESS_LOGS_COLLECTION_ID || "",
        diiOptionId: e.WEBFLOW_OPTION_DII_ID || "",
        fiiOptionId: e.WEBFLOW_OPTION_FII_ID || "",
        activeOptionId: e.WEBFLOW_OPTION_ACTIVE_ID || "",
        inactiveOptionId: e.WEBFLOW_OPTION_INACTIVE_ID || "",
        sessionSecret: e.SESSION_SECRET || "",
        sessionHours: Number(e.SESSION_HOURS || 8),
        sessionCookieName: e.SESSION_COOKIE_NAME || "dc_portal_session",
        loginMaxAttempts: Number(e.LOGIN_MAX_ATTEMPTS || 5),
        loginWindowMinutes: Number(e.LOGIN_WINDOW_MINUTES || 15),
    } as const;
}

// ─── String utilities ─────────────────────────────────────────────────────────

export const safeLower = (v: unknown) => String(v ?? "").trim().toLowerCase();
export const sanitizeText = (v: unknown) => String(v ?? "").trim();

export function getField<T = unknown>(
    fieldData: Record<string, unknown>,
    keys: string[],
    fallback: T
): T {
    for (const key of keys) {
        if (fieldData[key] !== undefined && fieldData[key] !== null)
            return fieldData[key] as T;
    }
    return fallback;
}

export function parseBoolean(value: unknown, fallback = false): boolean {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value > 0;
    const n = safeLower(value);
    if (["true", "1", "yes", "active", "on"].includes(n)) return true;
    if (["false", "0", "no", "inactive", "off"].includes(n)) return false;
    return fallback;
}

// ─── Webflow field extractors ─────────────────────────────────────────────────

export function normalizeInvestorType(raw: unknown, cfg: ReturnType<typeof getConfig>): string {
    if (!raw) return "";
    const s = sanitizeText(raw);
    const l = s.toLowerCase();
    if (cfg.diiOptionId && s === cfg.diiOptionId) return "dii";
    if (cfg.fiiOptionId && s === cfg.fiiOptionId) return "fii";
    if (l.includes("dii") || l.includes("domestic")) return "dii";
    if (l.includes("fii") || l.includes("foreign")) return "fii";
    return "";
}

export function normalizeScope(raw: unknown, cfg: ReturnType<typeof getConfig>): string {
    const scope = normalizeInvestorType(raw, cfg);
    if (scope) return scope;
    const l = safeLower(raw);
    if (l === "both" || l.includes("both")) return "both";
    return "";
}

export function isInvestorActive(fieldData: Record<string, unknown>, cfg: ReturnType<typeof getConfig>): boolean {
    const switchBased = getField<unknown>(fieldData, ["is_active", "is-active"], undefined);
    if (switchBased !== undefined) return parseBoolean(switchBased, false);
    const status = sanitizeText(getField(fieldData, ["status"], ""));
    if (!status) return true;
    if (cfg.activeOptionId && status === cfg.activeOptionId) return true;
    if (cfg.inactiveOptionId && status === cfg.inactiveOptionId) return false;
    const l = status.toLowerCase();
    if (l.includes("inactive")) return false;
    if (l.includes("active")) return true;
    return true;
}

export function extractInvestorDisplay(
    item: { id: string; fieldData: Record<string, unknown> },
    cfg: ReturnType<typeof getConfig>
) {
    const fd = item.fieldData;
    return {
        id: item.id,
        investor_id: sanitizeText(getField(fd, ["investor_id", "investor-id"], item.id)),
        name: sanitizeText(getField(fd, ["name"], "Investor")),
        email: safeLower(getField(fd, ["email"], "")),
        investor_type: normalizeInvestorType(getField(fd, ["investor_type", "investor-type"], ""), cfg) || "",
        is_active: isInvestorActive(fd, cfg),
        is_admin: parseBoolean(getField(fd, ["is_admin", "is-admin"], false), false),
    };
}

export function extractPassword(fieldData: Record<string, unknown>): string {
    return sanitizeText(getField(fieldData, ["password_plaintext", "password-plaintext", "password"], ""));
}

export function extractReferenceIds(value: unknown): string[] {
    if (!value) return [];
    if (typeof value === "string") return [value];
    if (Array.isArray(value)) return value.flatMap(extractReferenceIds);
    if (typeof value === "object") {
        const v = value as Record<string, unknown>;
        const ids: string[] = [];
        if (v.id) ids.push(String(v.id));
        if (v.itemId) ids.push(String(v.itemId));
        if (v.slug) ids.push(String(v.slug));
        if (Array.isArray(v.ids)) ids.push(...v.ids.map(String));
        return ids;
    }
    return [];
}

export function extractFileUrl(fieldData: Record<string, unknown>): string {
    const f = getField(fieldData, ["file_asset", "file-asset", "file"], null);
    if (!f) return "";
    if (typeof f === "string") return f;
    if (typeof f === "object" && f) {
        const v = f as Record<string, unknown>;
        return sanitizeText(v.url || v.fileUrl || v.src || "");
    }
    return "";
}

// ─── Webflow API ──────────────────────────────────────────────────────────────

export async function webflowFetch(
    relativePath: string,
    cfg: ReturnType<typeof getConfig>,
    options: RequestInit = {}
): Promise<unknown> {
    const url = `${cfg.webflowHost}${relativePath}`;
    const res = await fetch(url, {
        ...options,
        headers: {
            Authorization: `Bearer ${cfg.webflowToken}`,
            "Content-Type": "application/json",
            ...(options.headers ?? {}),
        },
    });
    if (!res.ok) {
        const body = await res.text();
        throw new Error(`Webflow API ${res.status}: ${body}`);
    }
    return res.json();
}

export async function listCollectionItems(
    collectionId: string,
    cfg: ReturnType<typeof getConfig>,
    live = cfg.webflowUseLive
): Promise<Array<{ id: string; fieldData: Record<string, unknown>; lastPublished?: string; createdOn?: string }>> {
    const items: Array<{ id: string; fieldData: Record<string, unknown>; lastPublished?: string; createdOn?: string }> = [];
    let offset = 0;
    const limit = 100;
    for (; ;) {
        const endpoint = live
            ? `/collections/${collectionId}/items/live`
            : `/collections/${collectionId}/items`;
        const payload = (await webflowFetch(
            `${endpoint}?limit=${limit}&offset=${offset}`,
            cfg,
            { method: "GET" }
        )) as { items?: typeof items; pagination?: { total?: number } };
        const batch = payload.items ?? [];
        items.push(...batch);
        const total = Number(payload.pagination?.total ?? 0);
        if (batch.length < limit) break;
        if (total > 0 && items.length >= total) break;
        offset += batch.length;
    }
    return items;
}

export async function createCollectionItem(
    collectionId: string,
    fieldData: Record<string, unknown>,
    cfg: ReturnType<typeof getConfig>
): Promise<unknown> {
    const payload = { isArchived: false, isDraft: false, fieldData };
    if (cfg.webflowUseLive) {
        try {
            return await webflowFetch(`/collections/${collectionId}/items/live`, cfg, {
                method: "POST",
                body: JSON.stringify(payload),
            });
        } catch {
            // fall through to draft
        }
    }
    return webflowFetch(`/collections/${collectionId}/items`, cfg, {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

export async function patchCollectionItem(
    collectionId: string,
    itemId: string,
    fieldData: Record<string, unknown>,
    cfg: ReturnType<typeof getConfig>
): Promise<unknown> {
    const payload = { isArchived: false, isDraft: false, fieldData };
    if (cfg.webflowUseLive) {
        try {
            return await webflowFetch(`/collections/${collectionId}/items/${itemId}/live`, cfg, {
                method: "PATCH",
                body: JSON.stringify(payload),
            });
        } catch {
            // fall through to draft
        }
    }
    return webflowFetch(`/collections/${collectionId}/items/${itemId}`, cfg, {
        method: "PATCH",
        body: JSON.stringify(payload),
    });
}

// ─── JWT / Session ────────────────────────────────────────────────────────────

export interface SessionPayload {
    id: string;
    investor_id: string;
    name: string;
    email: string;
    investor_type: string;
    is_active: boolean;
    is_admin: boolean;
    ref_ids: string[];
}

export async function buildSessionToken(
    payload: SessionPayload,
    cfg: ReturnType<typeof getConfig>
): Promise<string> {
    const secret = new TextEncoder().encode(cfg.sessionSecret);
    return new SignJWT({ ...payload })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime(`${cfg.sessionHours}h`)
        .setIssuedAt()
        .sign(secret);
}

export async function verifySessionToken(
    token: string,
    cfg: ReturnType<typeof getConfig>
): Promise<SessionPayload> {
    const secret = new TextEncoder().encode(cfg.sessionSecret);
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as SessionPayload;
}

export function sessionCookieOptions(cfg: ReturnType<typeof getConfig>) {
    return {
        name: cfg.sessionCookieName,
        httpOnly: true,
        secure: true,
        sameSite: "none" as const,
        maxAge: cfg.sessionHours * 60 * 60,
        path: "/",
    };
}

// ─── Session from request ─────────────────────────────────────────────────────

export async function getSession(
    req: NextRequest,
    cfg: ReturnType<typeof getConfig>
): Promise<SessionPayload | null> {
    const cookieToken = req.cookies.get(cfg.sessionCookieName)?.value;
    if (cookieToken) {
        try {
            return await verifySessionToken(cookieToken, cfg);
        } catch {
            // fall through to Authorization header token
        }
    }

    const authHeader = req.headers.get("authorization") || "";
    const bearerPrefix = "bearer ";
    const normalized = authHeader.trim();
    const token = normalized.toLowerCase().startsWith(bearerPrefix)
        ? normalized.slice(bearerPrefix.length).trim()
        : "";
    if (!token) return null;

    try {
        return await verifySessionToken(token, cfg);
    } catch {
        return null;
    }
}

// ─── Rate limiting via KV ─────────────────────────────────────────────────────

export async function isRateLimited(
    kv: KVNamespace,
    ip: string,
    email: string,
    cfg: ReturnType<typeof getConfig>
): Promise<boolean> {
    const key = `ratelimit:${ip}:${safeLower(email)}`;
    const raw = await kv.get(key);
    if (!raw) return false;
    const count = Number(raw);
    return count >= cfg.loginMaxAttempts;
}

export async function registerFailedAttempt(
    kv: KVNamespace,
    ip: string,
    email: string,
    cfg: ReturnType<typeof getConfig>
): Promise<void> {
    const key = `ratelimit:${ip}:${safeLower(email)}`;
    const raw = await kv.get(key);
    const count = Number(raw ?? 0) + 1;
    await kv.put(key, String(count), { expirationTtl: cfg.loginWindowMinutes * 60 });
}

export async function clearFailedAttempts(
    kv: KVNamespace,
    ip: string,
    email: string
): Promise<void> {
    await kv.delete(`ratelimit:${ip}:${safeLower(email)}`);
}

// ─── Cloudflare context helper ────────────────────────────────────────────────

declare const process: { env: Record<string, string> };

export function getEnvFromProcess(): CloudflareEnv {
    return process.env as unknown as CloudflareEnv;
}
