import { NextRequest, NextResponse } from "next/server";
import {
    getConfig, getEnvFromProcess, getSession, listCollectionItems,
    safeLower, sanitizeText, getField, parseBoolean, normalizeScope,
    extractReferenceIds, extractFileUrl, webflowFetch,
} from "@/app/lib/api";

type OptionIdNameMap = Record<string, string>;

let reportTypeOptionMapCache: {
    key: string;
    expiresAt: number;
    map: OptionIdNameMap;
} | null = null;

function isCacheValid(cache: { expiresAt: number } | null): boolean {
    return Boolean(cache && cache.expiresAt > Date.now());
}

function getFieldKeysForMatching(field: Record<string, unknown>): string[] {
    return [
        safeLower(field.slug),
        safeLower(field.displayName),
        safeLower(field.name),
        safeLower(field.id),
    ].filter(Boolean);
}

function isTypeOfReportField(field: Record<string, unknown>): boolean {
    const keys = getFieldKeysForMatching(field);
    return keys.some((key) =>
        key === "type of report" ||
        key === "type_of_report" ||
        key === "type-of-report" ||
        key.startsWith("type-of-report-") ||
        key === "report type" ||
        key === "report_type" ||
        key === "report-type"
    );
}

function extractOptionsFromField(field: Record<string, unknown>): Array<Record<string, unknown>> {
    const metadata = field.metadata as Record<string, unknown> | undefined;
    const options = metadata?.options;
    if (Array.isArray(options)) return options as Array<Record<string, unknown>>;
    return [];
}

function buildOptionIdNameMap(options: Array<Record<string, unknown>>): OptionIdNameMap {
    const map: OptionIdNameMap = {};
    for (const option of options) {
        const id = sanitizeText(option.id);
        if (!id) continue;

        const name = sanitizeText(option.name || option.label || option.value || option.slug || id);
        map[id] = name;
    }
    return map;
}

async function getTypeOfReportOptionMap(cfg: ReturnType<typeof getConfig>): Promise<OptionIdNameMap> {
    if (!cfg.documentsCollectionId) return {};

    const cacheKey = `type-of-report:${cfg.documentsCollectionId}`;
    if (reportTypeOptionMapCache && reportTypeOptionMapCache.key === cacheKey && isCacheValid(reportTypeOptionMapCache)) {
        return reportTypeOptionMapCache.map;
    }

    try {
        const payload = await webflowFetch(`/collections/${cfg.documentsCollectionId}`, cfg, { method: "GET" }) as Record<string, unknown>;
        const fields = Array.isArray(payload.fields) ? payload.fields as Array<Record<string, unknown>> : [];
        const reportField = fields.find(isTypeOfReportField);
        const optionMap = reportField ? buildOptionIdNameMap(extractOptionsFromField(reportField)) : {};

        reportTypeOptionMapCache = {
            key: cacheKey,
            expiresAt: Date.now() + (10 * 60 * 1000),
            map: optionMap,
        };
        return optionMap;
    } catch {
        return {};
    }
}

function extractOptionText(value: unknown, optionMap: OptionIdNameMap): string {
    if (value === null || value === undefined) return "";

    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        const normalized = sanitizeText(value);
        if (normalized && optionMap[normalized]) return optionMap[normalized];
        return normalized;
    }

    if (Array.isArray(value)) {
        for (const part of value) {
            const parsed = extractOptionText(part, optionMap);
            if (parsed) return parsed;
        }
        return "";
    }

    if (typeof value === "object") {
        const v = value as Record<string, unknown>;
        const id = sanitizeText(v.id || v.optionId || v.valueId || "");
        if (id && optionMap[id]) return optionMap[id];

        const candidates = [v.name, v.label, v.value, v.slug, v.title, v.id];
        for (const candidate of candidates) {
            const parsed = extractOptionText(candidate, optionMap);
            if (parsed) return parsed;
        }
    }

    return "";
}




export async function GET(req: NextRequest) {
    try {
        const env = getEnvFromProcess();
        const cfg = getConfig(env);
        const session = await getSession(req, cfg);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const typeOfReportOptionMap = await getTypeOfReportOptionMap(cfg);

        const { searchParams } = new URL(req.url);
        const search = safeLower(searchParams.get("search") || "");
        const categoryFilter = safeLower(searchParams.get("category") || "all");
        const sort = safeLower(searchParams.get("sort") || "newest");
        const dateRule = safeLower(searchParams.get("date") || "all");

        const rawDocs = await listCollectionItems(cfg.documentsCollectionId, cfg);

        const filtered = rawDocs
            .map((item) => {
                const fd = item.fieldData as Record<string, unknown>;
                const refIds = extractReferenceIds(getField(fd, ["investor_ref", "investor-ref", "investor"], null));
                const scope = normalizeScope(getField(fd, ["investor_type_scope", "investor-type-scope"], "both"), cfg) || "both";
                const isVisible = parseBoolean(getField(fd, ["is_visible", "is-visible"], true), true);
                const title = sanitizeText(getField(fd, ["title", "name"], "Untitled Document"));
                const reportTypeRaw = getField(
                    fd,
                    ["type_of_report", "type-of-report", "report_type", "report-type", "category"],
                    "Other"
                );
                const category = sanitizeText(extractOptionText(reportTypeRaw, typeOfReportOptionMap) || "Other");
                // Prefer explicit CMS date field; fall back to legacy published_date, then system timestamps.
                const documentDate = sanitizeText(
                    getField(
                        fd,
                        ["date", "document_date", "document-date", "published_date", "published-date"],
                        item.lastPublished || item.createdOn || ""
                    )
                );
                const normalizedDate = isNaN(new Date(documentDate).getTime()) ? null : new Date(documentDate);

                return {
                    id: item.id,
                    document_id: sanitizeText(getField(fd, ["document_id", "document-id"], item.id)),
                    title,
                    category,
                    description: sanitizeText(getField(fd, ["description"], "")),
                    file_url: extractFileUrl(fd),
                    file_type: sanitizeText(getField(fd, ["file_type", "file-type"], "")),
                    file_size_label: sanitizeText(getField(fd, ["file_size_label", "file-size-label"], "")),
                    published_date: documentDate,
                    created_on: item.createdOn,
                    investor_ref_ids: refIds,
                    scope,
                    is_visible: isVisible,
                    normalized_date: normalizedDate,
                };
            })
            .filter((doc) => {
                if (!doc.is_visible) return false;
                const authorizedByRef = doc.investor_ref_ids.some(
                    (refId) => refId === session.id || refId === session.investor_id
                );
                if (!authorizedByRef) return false;
                const scopeAllowed = doc.scope === "both" || doc.scope === safeLower(session.investor_type);
                if (!scopeAllowed) return false;
                const matchesSearch =
                    !search ||
                    safeLower(doc.title).includes(search) ||
                    safeLower(doc.category).includes(search) ||
                    safeLower(doc.file_type).includes(search);
                if (!matchesSearch) return false;
                const matchesCategory = !categoryFilter || categoryFilter === "all" || safeLower(doc.category) === categoryFilter;
                if (!matchesCategory) return false;
                if (!doc.normalized_date) return false;
                if (dateRule !== "all") {
                    const now = new Date();
                    now.setHours(0, 0, 0, 0);
                    const threshold = new Date(now);
                    if (dateRule === "last7") threshold.setDate(threshold.getDate() - 7);
                    else if (dateRule === "last30") threshold.setDate(threshold.getDate() - 30);
                    else if (dateRule === "last90") threshold.setDate(threshold.getDate() - 90);
                    else if (dateRule === "thisyear") threshold.setMonth(0, 1);
                    if (doc.normalized_date < threshold) return false;
                }
                return true;
            })
            .sort((a, b) => {
                const dateA = a.normalized_date?.getTime() ?? 0;
                const dateB = b.normalized_date?.getTime() ?? 0;
                if (sort === "oldest") return dateA - dateB;
                if (sort === "titleasc") return a.title.localeCompare(b.title);
                if (sort === "titledesc") return b.title.localeCompare(a.title);
                return dateB - dateA;
            })
            .map((doc) => ({
                id: doc.id,
                document_id: doc.document_id,
                title: doc.title,
                category: doc.category,
                description: doc.description,
                file_url: doc.file_url,
                file_type: doc.file_type,
                file_size_label: doc.file_size_label,
                published_date: doc.published_date,
            }));

        return NextResponse.json({ documents: filtered, total: filtered.length });
    } catch (err) {
        console.error("Documents error:", err);
        return NextResponse.json({ error: "Failed to fetch documents" }, { status: 500 });
    }
}
