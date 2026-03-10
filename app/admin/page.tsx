import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  extractInvestorDisplay,
  getConfig,
  getEnvFromProcess,
  getField,
  getSessionFromCookieStore,
  listCollectionItems,
  parseBoolean,
  safeLower,
  sanitizeText,
} from "@/app/lib/api";

type AccessGroup = {
  id: string;
  name: string;
  slug: string;
};

type Category = {
  id: string;
  name: string;
  slug: string;
};

type InvestorRow = {
  id: string;
  name: string;
  email: string;
  status: string;
  investorType: string;
  isAdmin: boolean;
  accessGroup: string;
};

type DocumentRow = {
  id: string;
  title: string;
  category: string;
  accessGroup: string;
  investorName: string;
  showToAllMembers: boolean;
  date: string;
};

export default async function AdminPage() {
  const env = getEnvFromProcess();
  const cfg = getConfig(env);
  const session = await getSessionFromCookieStore(await cookies(), cfg);

  if (!session) {
    redirect("/");
  }

  if (!session.is_admin) {
    redirect("/dashboard");
  }

  const [investorItems, documentItems, groupItems, categoryItems] = await Promise.all([
    listCollectionItems(cfg.investorsCollectionId, cfg),
    listCollectionItems(cfg.documentsCollectionId, cfg),
    listCollectionItems("69b065f058cc8e2da1b5ae22", cfg),
    listCollectionItems("69aef3e128bd937922c65eee", cfg),
  ]);

  const accessGroups = groupItems
    .map((item) => {
      const fd = item.fieldData as Record<string, unknown>;
      return {
        id: item.id,
        name: sanitizeText(getField(fd, ["name"], "")),
        slug: sanitizeText(getField(fd, ["slug"], "")),
      } satisfies AccessGroup;
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
      } satisfies Category;
    })
    .filter((item) => item.name);
  const categoryById = new Map(categories.map((category) => [category.id, category]));

  const investors = investorItems.map((item) => {
    const fd = item.fieldData as Record<string, unknown>;
    const investor = extractInvestorDisplay(item as { id: string; fieldData: Record<string, unknown> }, cfg);
    const groupId = sanitizeText(getField(fd, ["access-group", "access_group"], ""));
    const status = sanitizeText(getField(fd, ["status"], investor.is_active ? "Active" : "Inactive"));

    return {
      id: item.id,
      name: investor.name,
      email: investor.email,
      status,
      investorType: investor.investor_type ? investor.investor_type.toUpperCase() : "Unassigned",
      isAdmin: investor.is_admin,
      accessGroup: accessGroupById.get(groupId)?.name || "None",
    } satisfies InvestorRow;
  });
  const investorNameById = new Map(investors.map((investor) => [investor.id, investor.name]));

  const documents = documentItems.map((item) => {
    const fd = item.fieldData as Record<string, unknown>;
    const investorId = sanitizeText(getField(fd, ["investor"], ""));
    const accessGroupId = sanitizeText(getField(fd, ["access-group", "access_group"], ""));
    const categoryId = sanitizeText(getField(fd, ["type-of-reports", "type_of_reports"], ""));
    const rawStatusCategory = categoryById.get(categoryId)?.name || "Uncategorized";

    return {
      id: item.id,
      title: sanitizeText(getField(fd, ["name", "title"], "Untitled Document")),
      category: rawStatusCategory,
      accessGroup: accessGroupById.get(accessGroupId)?.name || "None",
      investorName: investorNameById.get(investorId) || "None",
      showToAllMembers: parseBoolean(getField(fd, ["show-to-all-members", "show_to_all_members"], false), false),
      date: sanitizeText(getField(fd, ["date"], "")),
    } satisfies DocumentRow;
  });

  const docsByGroup = new Map<string, number>();
  const membersByGroup = new Map<string, number>();

  investors.forEach((investor) => {
    if (!investor.accessGroup || investor.accessGroup === "None") return;
    membersByGroup.set(investor.accessGroup, (membersByGroup.get(investor.accessGroup) || 0) + 1);
  });
  documents.forEach((document) => {
    if (!document.accessGroup || document.accessGroup === "None") return;
    docsByGroup.set(document.accessGroup, (docsByGroup.get(document.accessGroup) || 0) + 1);
  });

  const adminCount = investors.filter((investor) => investor.isAdmin).length;
  const globalDocuments = documents.filter((document) => document.showToAllMembers).length;
  const groupedDocuments = documents.filter((document) => document.accessGroup !== "None").length;

  return (
    <main className="admin-page">
      <section className="admin-shell">
        <header className="admin-header">
          <div>
            <p className="admin-eyebrow">Portal Admin</p>
            <h1>Access control dashboard</h1>
            <p className="admin-subtitle">
              Review investors, access groups, and document visibility in one place.
            </p>
          </div>
          <div className="admin-actions">
            <Link href="https://www.dhammacapital.in/dashboard" className="admin-link-button">
              Open member dashboard
            </Link>
          </div>
        </header>

        <section className="admin-stats">
          <StatCard label="Investors" value={String(investors.length)} helper={`${adminCount} admins`} />
          <StatCard label="Documents" value={String(documents.length)} helper={`${globalDocuments} global`} />
          <StatCard label="Access Groups" value={String(accessGroups.length)} helper={`${groupedDocuments} grouped docs`} />
          <StatCard label="Categories" value={String(categories.length)} helper="CMS-backed filters" />
        </section>

        <section className="admin-grid">
          <AdminPanel
            title="Access Groups"
            subtitle="Use one shared group to give multiple investors the same document visibility."
          >
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Group</th>
                  <th>Members</th>
                  <th>Docs</th>
                  <th>Slug</th>
                </tr>
              </thead>
              <tbody>
                {accessGroups.length ? accessGroups.map((group) => (
                  <tr key={group.id}>
                    <td>{group.name}</td>
                    <td>{membersByGroup.get(group.name) || 0}</td>
                    <td>{docsByGroup.get(group.name) || 0}</td>
                    <td>{group.slug}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4}>No access groups created yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </AdminPanel>

          <AdminPanel
            title="Document Access Model"
            subtitle="A document can be global, tied to one investor, or tied to one shared access group."
          >
            <div className="admin-rule-list">
              <div className="admin-rule">
                <strong>Global</strong>
                <span>`Show To All Members` is on</span>
              </div>
              <div className="admin-rule">
                <strong>Direct</strong>
                <span>Document points to one investor</span>
              </div>
              <div className="admin-rule">
                <strong>Shared</strong>
                <span>Investor and document use the same access group</span>
              </div>
            </div>
          </AdminPanel>
        </section>

        <AdminPanel
          title="Investors"
          subtitle="Quickly see who is admin, which investor type they belong to, and whether they are assigned to an access group."
        >
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Type</th>
                <th>Status</th>
                <th>Admin</th>
                <th>Access Group</th>
              </tr>
            </thead>
            <tbody>
              {investors.map((investor) => (
                <tr key={investor.id}>
                  <td>{investor.name}</td>
                  <td>{investor.email}</td>
                  <td>{investor.investorType}</td>
                  <td>{normalizeStatusLabel(investor.status)}</td>
                  <td>{investor.isAdmin ? "Yes" : "No"}</td>
                  <td>{investor.accessGroup}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminPanel>

        <AdminPanel
          title="Documents"
          subtitle="This is the current visibility source for each document."
        >
          <table className="admin-table">
            <thead>
              <tr>
                <th>Document</th>
                <th>Category</th>
                <th>Global</th>
                <th>Investor</th>
                <th>Access Group</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((document) => (
                <tr key={document.id}>
                  <td>{document.title}</td>
                  <td>{document.category}</td>
                  <td>{document.showToAllMembers ? "Yes" : "No"}</td>
                  <td>{document.investorName}</td>
                  <td>{document.accessGroup}</td>
                  <td>{document.date ? new Date(document.date).toLocaleDateString("en-IN") : "None"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminPanel>
      </section>
    </main>
  );
}

function AdminPanel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="admin-panel">
      <div className="admin-panel-header">
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function StatCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <article className="admin-stat-card">
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{helper}</span>
    </article>
  );
}

function normalizeStatusLabel(status: string) {
  const normalized = safeLower(status);
  if (normalized.includes("active")) return "Active";
  if (normalized.includes("inactive")) return "Inactive";
  return status || "Unknown";
}
