import {
    createCollectionItem,
    extractFileUrl,
    extractInvestorDisplay,
    getConfig,
    getField,
    listCollectionItems,
    parseBoolean,
    patchCollectionItem,
    safeLower,
    sanitizeText,
} from "@/app/lib/api";

export const ACCESS_GROUPS_COLLECTION_ID = "69b065f058cc8e2da1b5ae22";
export const DOCUMENT_CATEGORIES_COLLECTION_ID = "69aef3e128bd937922c65eee";

export type AdminOverviewData = {
    stats: {
        investors: number;
        admins: number;
        documents: number;
        globalDocuments: number;
        groupedDocuments: number;
        accessGroups: number;
        categories: number;
    };
    accessGroups: Array<{
        id: string;
        name: string;
        slug: string;
        membersCount: number;
        documentsCount: number;
    }>;
    investors: Array<{
        id: string;
        name: string;
        slug: string;
        email: string;
        investorType: string;
        isAdmin: boolean;
        status: string;
        isActive: boolean;
        accessGroupId: string;
        accessGroupName: string;
    }>;
    documents: Array<{
        id: string;
        title: string;
        slug: string;
        date: string;
        categoryId: string;
        categoryName: string;
        investorId: string;
        investorName: string;
        accessGroupId: string;
        accessGroupName: string;
        showToAllMembers: boolean;
        fileUrl: string;
        fileSizeLabel: string;
    }>;
    categories: Array<{
        id: string;
        name: string;
        slug: string;
        documentsCount: number;
    }>;
};

export type AdminInvestorInput = {
    name: string;
    slug?: string;
    email: string;
    password?: string;
    investorType: string;
    status: string;
    isAdmin?: boolean;
    accessGroupId?: string;
};

export type AdminDocumentInput = {
    title: string;
    slug?: string;
    fileUrl?: string;
    date?: string;
    categoryId?: string;
    investorId?: string;
    accessGroupId?: string;
    showToAllMembers?: boolean;
};

function slugify(value: string): string {
    return sanitizeText(value)
        .toLowerCase()
        .replace(/&/g, " and ")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function normalizeDateField(value: string): string {
    const trimmed = sanitizeText(value);
    if (!trimmed) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        return `${trimmed}T00:00:00.000Z`;
    }

    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
        throw new Error("Document date must be a valid date.");
    }
    return parsed.toISOString();
}

function formatDateInput(value: string): string {
    const trimmed = sanitizeText(value);
    if (!trimmed) return "";
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
        return trimmed.slice(0, 10);
    }
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toISOString().slice(0, 10);
}

function investorTypeFieldValue(value: string, cfg: ReturnType<typeof getConfig>): string {
    const normalized = safeLower(value);
    if (normalized === "dii") return cfg.diiOptionId || "DII";
    if (normalized === "fii") return cfg.fiiOptionId || "FII";
    throw new Error("Investor type must be DII or FII.");
}

function statusFieldValue(value: string, cfg: ReturnType<typeof getConfig>): string {
    const normalized = safeLower(value || "active");
    if (normalized === "active") return cfg.activeOptionId || "Active";
    if (normalized === "inactive") return cfg.inactiveOptionId || "Inactive";
    throw new Error("Investor status must be Active or Inactive.");
}

function buildSimpleNamedFieldData(name: string, slug?: string) {
    const normalizedName = sanitizeText(name);
    const normalizedSlug = sanitizeText(slug) || slugify(normalizedName);
    if (!normalizedName) {
        throw new Error("Name is required.");
    }
    if (!normalizedSlug) {
        throw new Error("Slug is required.");
    }
    return {
        name: normalizedName,
        slug: normalizedSlug,
    };
}

function buildInvestorFieldData(
    input: AdminInvestorInput,
    cfg: ReturnType<typeof getConfig>,
    isCreate = false
) {
    const name = sanitizeText(input.name);
    const slug = sanitizeText(input.slug) || slugify(name);
    const email = safeLower(input.email);
    const password = sanitizeText(input.password);

    if (!name) {
        throw new Error("Investor name is required.");
    }
    if (!email) {
        throw new Error("Investor email is required.");
    }
    if (!slug) {
        throw new Error("Investor slug is required.");
    }
    if (isCreate && !password) {
        throw new Error("A password is required when creating an investor.");
    }
    if (password && password.length < 8) {
        throw new Error("Investor password must be at least 8 characters.");
    }

    const fieldData: Record<string, unknown> = {
        name,
        slug,
        email,
        password,
        "investor-type": investorTypeFieldValue(input.investorType, cfg),
        status: statusFieldValue(input.status, cfg),
        "is-admin": Boolean(input.isAdmin),
        "access-group": sanitizeText(input.accessGroupId),
    };

    if (!fieldData.password) {
        delete fieldData.password;
    }

    return fieldData;
}

function buildDocumentFieldData(input: AdminDocumentInput, isCreate = false) {
    const title = sanitizeText(input.title);
    const slug = sanitizeText(input.slug) || slugify(title);
    const fileUrl = sanitizeText(input.fileUrl);

    if (!title) {
        throw new Error("Document title is required.");
    }
    if (!slug) {
        throw new Error("Document slug is required.");
    }
    if (isCreate && !fileUrl) {
        throw new Error("A public document file URL is required when creating a document.");
    }
    if (fileUrl && !/^https?:\/\//i.test(fileUrl)) {
        throw new Error("Document file URL must start with http:// or https://.");
    }

    const fieldData: Record<string, unknown> = {
        name: title,
        slug,
        date: input.date ? normalizeDateField(input.date) : "",
        "type-of-reports": sanitizeText(input.categoryId),
        investor: sanitizeText(input.investorId),
        "access-group": sanitizeText(input.accessGroupId),
        "show-to-all-members": Boolean(input.showToAllMembers),
    };

    if (fileUrl) {
        fieldData.file = { url: fileUrl };
    }

    return fieldData;
}

async function archiveCollectionItem(
    collectionId: string,
    itemId: string,
    cfg: ReturnType<typeof getConfig>
) {
    const items = await listCollectionItems(collectionId, cfg);
    const current = items.find((item) => item.id === itemId);
    if (!current) {
        throw new Error("Item not found.");
    }

    return patchCollectionItem(
        collectionId,
        itemId,
        current.fieldData,
        cfg,
        {
            isArchived: true,
            useLive: true,
            fallbackToDraft: false,
        }
    );
}

export async function loadAdminOverview(cfg: ReturnType<typeof getConfig>): Promise<AdminOverviewData> {
    const [investorItems, documentItems, accessGroupItems, categoryItems] = await Promise.all([
        listCollectionItems(cfg.investorsCollectionId, cfg),
        listCollectionItems(cfg.documentsCollectionId, cfg),
        listCollectionItems(ACCESS_GROUPS_COLLECTION_ID, cfg),
        listCollectionItems(DOCUMENT_CATEGORIES_COLLECTION_ID, cfg),
    ]);

    const accessGroups = accessGroupItems
        .map((item) => {
            const fd = item.fieldData as Record<string, unknown>;
            return {
                id: item.id,
                name: sanitizeText(getField(fd, ["name"], "")),
                slug: sanitizeText(getField(fd, ["slug"], "")),
                membersCount: 0,
                documentsCount: 0,
            };
        })
        .filter((item) => item.name)
        .sort((a, b) => a.name.localeCompare(b.name));
    const accessGroupById = new Map(accessGroups.map((group) => [group.id, group]));

    const categories = categoryItems
        .map((item) => {
            const fd = item.fieldData as Record<string, unknown>;
            return {
                id: item.id,
                name: sanitizeText(getField(fd, ["name"], "")),
                slug: sanitizeText(getField(fd, ["slug"], "")),
                documentsCount: 0,
            };
        })
        .filter((item) => item.name)
        .sort((a, b) => a.name.localeCompare(b.name));
    const categoryById = new Map(categories.map((category) => [category.id, category]));

    const investors = investorItems
        .map((item) => {
            const fd = item.fieldData as Record<string, unknown>;
            const investor = extractInvestorDisplay(item as { id: string; fieldData: Record<string, unknown> }, cfg);
            const accessGroupId = sanitizeText(getField(fd, ["access-group", "access_group"], ""));
            const accessGroupName = accessGroupById.get(accessGroupId)?.name || "";
            if (accessGroupId && accessGroupById.has(accessGroupId)) {
                accessGroupById.get(accessGroupId)!.membersCount += 1;
            }

            return {
                id: item.id,
                name: investor.name,
                slug: sanitizeText(getField(fd, ["slug"], "")),
                email: investor.email,
                investorType: investor.investor_type ? investor.investor_type.toUpperCase() : "UNASSIGNED",
                isAdmin: investor.is_admin,
                status: investor.is_active ? "Active" : "Inactive",
                isActive: investor.is_active,
                accessGroupId,
                accessGroupName,
            };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
    const investorNameById = new Map(investors.map((investor) => [investor.id, investor.name]));

    const documents = documentItems
        .map((item) => {
            const fd = item.fieldData as Record<string, unknown>;
            const accessGroupId = sanitizeText(getField(fd, ["access-group", "access_group"], ""));
            const investorId = sanitizeText(getField(fd, ["investor"], ""));
            const categoryId = sanitizeText(getField(fd, ["type-of-reports", "type_of_reports"], ""));
            const showToAllMembers = parseBoolean(
                getField(fd, ["show-to-all-members", "show_to_all_members"], false),
                false
            );

            if (accessGroupId && accessGroupById.has(accessGroupId)) {
                accessGroupById.get(accessGroupId)!.documentsCount += 1;
            }
            if (categoryId && categoryById.has(categoryId)) {
                categoryById.get(categoryId)!.documentsCount += 1;
            }

            return {
                id: item.id,
                title: sanitizeText(getField(fd, ["name", "title"], "Untitled Document")),
                slug: sanitizeText(getField(fd, ["slug"], "")),
                date: formatDateInput(sanitizeText(getField(fd, ["date"], ""))),
                categoryId,
                categoryName: categoryById.get(categoryId)?.name || "Uncategorized",
                investorId,
                investorName: investorNameById.get(investorId) || "",
                accessGroupId,
                accessGroupName: accessGroupById.get(accessGroupId)?.name || "",
                showToAllMembers,
                fileUrl: extractFileUrl(fd),
                fileSizeLabel: sanitizeText(getField(fd, ["file_size_label", "file-size-label"], "")),
            };
        })
        .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));

    return {
        stats: {
            investors: investors.length,
            admins: investors.filter((investor) => investor.isAdmin).length,
            documents: documents.length,
            globalDocuments: documents.filter((document) => document.showToAllMembers).length,
            groupedDocuments: documents.filter((document) => Boolean(document.accessGroupId)).length,
            accessGroups: accessGroups.length,
            categories: categories.length,
        },
        accessGroups,
        investors,
        documents,
        categories,
    };
}

export async function createAccessGroup(name: string, slug: string, cfg: ReturnType<typeof getConfig>) {
    return createCollectionItem(
        ACCESS_GROUPS_COLLECTION_ID,
        buildSimpleNamedFieldData(name, slug),
        cfg,
        { useLive: true, fallbackToDraft: false }
    );
}

export async function updateAccessGroup(
    accessGroupId: string,
    name: string,
    slug: string,
    cfg: ReturnType<typeof getConfig>
) {
    return patchCollectionItem(
        ACCESS_GROUPS_COLLECTION_ID,
        accessGroupId,
        buildSimpleNamedFieldData(name, slug),
        cfg,
        { useLive: true, fallbackToDraft: false }
    );
}

export async function archiveAccessGroup(accessGroupId: string, cfg: ReturnType<typeof getConfig>) {
    return archiveCollectionItem(ACCESS_GROUPS_COLLECTION_ID, accessGroupId, cfg);
}

export async function createCategory(name: string, slug: string, cfg: ReturnType<typeof getConfig>) {
    return createCollectionItem(
        DOCUMENT_CATEGORIES_COLLECTION_ID,
        buildSimpleNamedFieldData(name, slug),
        cfg,
        { useLive: true, fallbackToDraft: false }
    );
}

export async function updateCategory(
    categoryId: string,
    name: string,
    slug: string,
    cfg: ReturnType<typeof getConfig>
) {
    return patchCollectionItem(
        DOCUMENT_CATEGORIES_COLLECTION_ID,
        categoryId,
        buildSimpleNamedFieldData(name, slug),
        cfg,
        { useLive: true, fallbackToDraft: false }
    );
}

export async function archiveCategory(categoryId: string, cfg: ReturnType<typeof getConfig>) {
    return archiveCollectionItem(DOCUMENT_CATEGORIES_COLLECTION_ID, categoryId, cfg);
}

export async function createInvestor(
    input: AdminInvestorInput,
    cfg: ReturnType<typeof getConfig>
) {
    return createCollectionItem(
        cfg.investorsCollectionId,
        buildInvestorFieldData(input, cfg, true),
        cfg,
        { useLive: true, fallbackToDraft: false }
    );
}

export async function updateInvestor(
    investorId: string,
    input: AdminInvestorInput,
    cfg: ReturnType<typeof getConfig>
) {
    return patchCollectionItem(
        cfg.investorsCollectionId,
        investorId,
        buildInvestorFieldData(input, cfg, false),
        cfg,
        { useLive: true, fallbackToDraft: false }
    );
}

export async function archiveInvestor(investorId: string, cfg: ReturnType<typeof getConfig>) {
    return archiveCollectionItem(cfg.investorsCollectionId, investorId, cfg);
}

export async function createDocument(
    input: AdminDocumentInput,
    cfg: ReturnType<typeof getConfig>
) {
    return createCollectionItem(
        cfg.documentsCollectionId,
        buildDocumentFieldData(input, true),
        cfg,
        {
            skipInvalidFiles: true,
            useLive: true,
            fallbackToDraft: false,
        }
    );
}

export async function updateDocument(
    documentId: string,
    input: AdminDocumentInput,
    cfg: ReturnType<typeof getConfig>
) {
    return patchCollectionItem(
        cfg.documentsCollectionId,
        documentId,
        buildDocumentFieldData(input, false),
        cfg,
        {
            skipInvalidFiles: true,
            useLive: true,
            fallbackToDraft: false,
        }
    );
}

export async function archiveDocument(documentId: string, cfg: ReturnType<typeof getConfig>) {
    return archiveCollectionItem(cfg.documentsCollectionId, documentId, cfg);
}
