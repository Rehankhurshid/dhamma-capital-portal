import { NextRequest, NextResponse } from "next/server";
import {
    extractFileUrl,
    extractReferenceIds,
    getConfig,
    getEnvFromProcess,
    getField,
    getSession,
    listCollectionItems,
    normalizeScope,
    parseBoolean,
    safeLower,
    sanitizeText,
    webflowFetch,
} from "@/app/lib/api";

type OptionIdNameMap = Record<string, string>;

type CategoryDescriptor = {
    id: string;
    name: string;
    slug: string;
};

type DocumentsSchemaMeta = {
    optionMap: OptionIdNameMap;
    categoryFieldSlug: string;
    categoryCollectionId: string;
};

let documentsSchemaCache: {
    key: string;
    expiresAt: number;
    meta: DocumentsSchemaMeta;
} | null = null;

function isCacheValid(cache: { expiresAt: number } | null): boolean {
    return Boolean(cache && cache.expiresAt > Date.now());
}

function slugifyCategory(value: unknown): string {
    return sanitizeText(value)
        .toLowerCase()
        .replace(/&/g, " and ")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
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
        key === "report-type" ||
        key === "category"
    );
}

function isDocumentCategoryReferenceField(field: Record<string, unknown>): boolean {
    const keys = getFieldKeysForMatching(field);
    return keys.some((key) =>
        key === "document category" ||
        key === "document_category" ||
        key === "document-category" ||
        key.startsWith("document-category-") ||
        key === "type of reports" ||
        key === "type_of_reports" ||
        key === "type-of-reports" ||
        key.startsWith("type-of-reports-")
    );
}

function extractOptionsFromField(field: Record<string, unknown>): Array<Record<string, unknown>> {
    const validations = field.validations as Record<string, unknown> | undefined;
    const validationOptions = validations?.options;
    if (Array.isArray(validationOptions)) return validationOptions as Array<Record<string, unknown>>;

    const metadata = field.metadata as Record<string, unknown> | undefined;
    const metadataOptions = metadata?.options;
    if (Array.isArray(metadataOptions)) return metadataOptions as Array<Record<string, unknown>>;

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

async function getDocumentsSchemaMeta(cfg: ReturnType<typeof getConfig>): Promise<DocumentsSchemaMeta> {
    if (!cfg.documentsCollectionId) {
        return {
            optionMap: {},
            categoryFieldSlug: "",
            categoryCollectionId: "",
        };
    }

    const cacheKey = `documents-schema:${cfg.documentsCollectionId}`;
    if (documentsSchemaCache && documentsSchemaCache.key === cacheKey && isCacheValid(documentsSchemaCache)) {
        return documentsSchemaCache.meta;
    }

    try {
        const payload = await webflowFetch(`/collections/${cfg.documentsCollectionId}`, cfg, {
            method: "GET",
        }) as Record<string, unknown>;
        const fields = Array.isArray(payload.fields) ? payload.fields as Array<Record<string, unknown>> : [];
        const reportField = fields.find(isTypeOfReportField);
        const categoryField = fields.find((field) =>
            safeLower(field.type) === "reference" && isDocumentCategoryReferenceField(field)
        );

        const validations = categoryField?.validations as Record<string, unknown> | undefined;
        const meta: DocumentsSchemaMeta = {
            optionMap: reportField ? buildOptionIdNameMap(extractOptionsFromField(reportField)) : {},
            categoryFieldSlug: sanitizeText(categoryField?.slug),
            categoryCollectionId: sanitizeText(validations?.collectionId || ""),
        };

        documentsSchemaCache = {
            key: cacheKey,
            expiresAt: Date.now() + (10 * 60 * 1000),
            meta,
        };
        return meta;
    } catch {
        return {
            optionMap: {},
            categoryFieldSlug: "",
            categoryCollectionId: "",
        };
    }
}

async function getCategoryDescriptors(
    collectionId: string,
    cfg: ReturnType<typeof getConfig>
): Promise<{ byId: Map<string, CategoryDescriptor>; ordered: CategoryDescriptor[] }> {
    if (!collectionId) {
        return { byId: new Map(), ordered: [] };
    }

    const items = await listCollectionItems(collectionId, cfg);
    const ordered = items
        .map((item) => {
            const fd = item.fieldData as Record<string, unknown>;
            const name = sanitizeText(getField(fd, ["name"], ""));
            const slug = sanitizeText(getField(fd, ["slug"], "")) || slugifyCategory(name);
            if (!name || !slug) return null;

            return {
                id: item.id,
                name,
                slug,
            } satisfies CategoryDescriptor;
        })
        .filter((item): item is CategoryDescriptor => Boolean(item));

    return {
        byId: new Map(ordered.map((item) => [item.id, item])),
        ordered,
    };
}

export async function GET(req: NextRequest) {
    try {
        const env = getEnvFromProcess();
        const cfg = getConfig(env);
        const session = await getSession(req, cfg);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const schemaMeta = await getDocumentsSchemaMeta(cfg);
        const categoryDescriptors = await getCategoryDescriptors(schemaMeta.categoryCollectionId, cfg);

        const { searchParams } = new URL(req.url);
        const search = safeLower(searchParams.get("search") || "");
        const categoryFilter = slugifyCategory(searchParams.get("category") || "all") || "all";
        const sort = safeLower(searchParams.get("sort") || "newest");
        const dateRule = safeLower(searchParams.get("date") || "all");

        const rawDocs = await listCollectionItems(cfg.documentsCollectionId, cfg);

        const authorizedDocuments = rawDocs
            .map((item) => {
                const fd = item.fieldData as Record<string, unknown>;
                const refIds = extractReferenceIds(getField(fd, ["investor_ref", "investor-ref", "investor"], null));
                const scope = normalizeScope(getField(fd, ["investor_type_scope", "investor-type-scope"], "both"), cfg) || "both";
                const isVisible = parseBoolean(getField(fd, ["is_visible", "is-visible"], true), true);
                const showToAllMembers = parseBoolean(
                    getField(fd, ["show-to-all-members", "show_to_all_members"], false),
                    false
                );
                const title = sanitizeText(getField(fd, ["title", "name"], "Untitled Document"));

                const categoryReferenceIds = extractReferenceIds(
                    getField(
                        fd,
                        [
                            schemaMeta.categoryFieldSlug,
                            "document-category",
                            "document_category",
                        ].filter(Boolean),
                        null
                    )
                );
                const referencedCategory = categoryReferenceIds
                    .map((id) => categoryDescriptors.byId.get(id))
                    .find(Boolean);
                const legacyCategory = extractOptionText(
                    getField(
                        fd,
                        ["type_of_report", "type-of-report", "report_type", "report-type", "category"],
                        "Other"
                    ),
                    schemaMeta.optionMap
                );
                const categoryName = sanitizeText(referencedCategory?.name || legacyCategory || "Other");
                const categorySlug = sanitizeText(referencedCategory?.slug || slugifyCategory(categoryName) || "other");

                const documentDate = sanitizeText(
                    getField(
                        fd,
                        ["date", "document_date", "document-date", "published_date", "published-date"],
                        item.lastPublished || item.createdOn || ""
                    )
                );
                const normalizedDate = Number.isNaN(new Date(documentDate).getTime()) ? null : new Date(documentDate);

                return {
                    id: item.id,
                    document_id: sanitizeText(getField(fd, ["document_id", "document-id"], item.id)),
                    title,
                    category: categoryName,
                    category_slug: categorySlug,
                    description: sanitizeText(getField(fd, ["description"], "")),
                    file_url: extractFileUrl(fd),
                    file_type: sanitizeText(getField(fd, ["file_type", "file-type"], "")),
                    file_size_label: sanitizeText(getField(fd, ["file_size_label", "file-size-label"], "")),
                    published_date: documentDate,
                    created_on: item.createdOn,
                    investor_ref_ids: refIds,
                    scope,
                    is_visible: isVisible,
                    show_to_all_members: showToAllMembers,
                    normalized_date: normalizedDate,
                };
            })
            .filter((doc) => {
                if (!doc.is_visible) return false;
                const authorizedByRef = doc.show_to_all_members || doc.investor_ref_ids.some(
                    (refId) => refId === session.id || refId === session.investor_id
                );
                if (!authorizedByRef) return false;
                return doc.scope === "both" || doc.scope === safeLower(session.investor_type);
            });

        const authorizedCategoryMap = new Map<string, CategoryDescriptor>();
        for (const doc of authorizedDocuments) {
            if (!doc.category_slug) continue;
            if (!authorizedCategoryMap.has(doc.category_slug)) {
                authorizedCategoryMap.set(doc.category_slug, {
                    id: doc.category_slug,
                    name: doc.category,
                    slug: doc.category_slug,
                });
            }
        }

        const categories = categoryDescriptors.ordered.length
            ? categoryDescriptors.ordered.filter((category) => authorizedCategoryMap.has(category.slug))
            : Array.from(authorizedCategoryMap.values()).sort((a, b) => a.name.localeCompare(b.name));

        const filtered = authorizedDocuments
            .filter((doc) => {
                const matchesSearch =
                    !search ||
                    safeLower(doc.title).includes(search) ||
                    safeLower(doc.category).includes(search) ||
                    safeLower(doc.file_type).includes(search);
                if (!matchesSearch) return false;

                const matchesCategory =
                    !categoryFilter ||
                    categoryFilter === "all" ||
                    doc.category_slug === categoryFilter;
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
                category_slug: doc.category_slug,
                description: doc.description,
                file_url: doc.file_url,
                file_type: doc.file_type,
                file_size_label: doc.file_size_label,
                published_date: doc.published_date,
            }));

        return NextResponse.json({
            documents: filtered,
            categories,
            total: filtered.length,
        });
    } catch (err) {
        console.error("Documents error:", err);
        return NextResponse.json({ error: "Failed to fetch documents" }, { status: 500 });
    }
}
