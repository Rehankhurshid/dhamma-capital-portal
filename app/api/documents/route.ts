import { NextRequest, NextResponse } from "next/server";
import {
    getConfig, getEnvFromProcess, getSession, listCollectionItems,
    safeLower, sanitizeText, getField, parseBoolean, normalizeScope,
    extractReferenceIds, extractFileUrl,
} from "@/app/lib/api";




export async function GET(req: NextRequest) {
    try {
        const env = getEnvFromProcess();
        const cfg = getConfig(env);
        const session = await getSession(req, cfg);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
                const category = sanitizeText(getField(fd, ["category"], "Other"));
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
