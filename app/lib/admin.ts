import {
  createCollectionItem,
  extractInvestorDisplay,
  getConfig,
  getField,
  listCollectionItems,
  parseBoolean,
  patchCollectionItem,
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
    email: string;
    investorType: string;
    isAdmin: boolean;
    status: string;
    accessGroupId: string;
    accessGroupName: string;
  }>;
  documents: Array<{
    id: string;
    title: string;
    date: string;
    categoryId: string;
    categoryName: string;
    investorId: string;
    investorName: string;
    accessGroupId: string;
    accessGroupName: string;
    showToAllMembers: boolean;
  }>;
  categories: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
};

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
    .filter((item) => item.name);
  const accessGroupById = new Map(accessGroups.map((group) => [group.id, group]));

  const categories = categoryItems
    .map((item) => {
      const fd = item.fieldData as Record<string, unknown>;
      return {
        id: item.id,
        name: sanitizeText(getField(fd, ["name"], "")),
        slug: sanitizeText(getField(fd, ["slug"], "")),
      };
    })
    .filter((item) => item.name);
  const categoryById = new Map(categories.map((category) => [category.id, category]));

  const investors = investorItems.map((item) => {
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
      email: investor.email,
      investorType: investor.investor_type ? investor.investor_type.toUpperCase() : "UNASSIGNED",
      isAdmin: investor.is_admin,
      status: investor.is_active ? "Active" : "Inactive",
      accessGroupId,
      accessGroupName,
    };
  });
  const investorNameById = new Map(investors.map((investor) => [investor.id, investor.name]));

  const documents = documentItems.map((item) => {
    const fd = item.fieldData as Record<string, unknown>;
    const accessGroupId = sanitizeText(getField(fd, ["access-group", "access_group"], ""));
    const investorId = sanitizeText(getField(fd, ["investor"], ""));
    const categoryId = sanitizeText(getField(fd, ["type-of-reports", "type_of_reports"], ""));
    const showToAllMembers = parseBoolean(getField(fd, ["show-to-all-members", "show_to_all_members"], false), false);

    if (accessGroupId && accessGroupById.has(accessGroupId)) {
      accessGroupById.get(accessGroupId)!.documentsCount += 1;
    }

    return {
      id: item.id,
      title: sanitizeText(getField(fd, ["name", "title"], "Untitled Document")),
      date: sanitizeText(getField(fd, ["date"], "")),
      categoryId,
      categoryName: categoryById.get(categoryId)?.name || "Uncategorized",
      investorId,
      investorName: investorNameById.get(investorId) || "",
      accessGroupId,
      accessGroupName: accessGroupById.get(accessGroupId)?.name || "",
      showToAllMembers,
    };
  });

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

export async function createAccessGroup(
  name: string,
  cfg: ReturnType<typeof getConfig>
) {
  const trimmed = sanitizeText(name);
  if (!trimmed) {
    throw new Error("Access group name is required");
  }

  const slug = trimmed
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return createCollectionItem(
    ACCESS_GROUPS_COLLECTION_ID,
    {
      name: trimmed,
      slug,
    },
    {
      ...cfg,
      webflowUseLive: true,
    }
  );
}

export async function updateInvestorAccess(
  investorId: string,
  fieldData: Record<string, unknown>,
  cfg: ReturnType<typeof getConfig>
) {
  return patchCollectionItem(
    cfg.investorsCollectionId,
    investorId,
    fieldData,
    {
      ...cfg,
      webflowUseLive: true,
    }
  );
}

export async function updateDocumentAccess(
  documentId: string,
  fieldData: Record<string, unknown>,
  cfg: ReturnType<typeof getConfig>
) {
  return patchCollectionItem(
    cfg.documentsCollectionId,
    documentId,
    fieldData,
    {
      ...cfg,
      webflowUseLive: true,
    }
  );
}
