"use client";

import { useState, useTransition } from "react";
import type { AdminOverviewData } from "@/app/lib/admin";

export function AdminDashboardClient({ initialData }: { initialData: AdminOverviewData }) {
  const [data, setData] = useState(initialData);
  const [groupName, setGroupName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  async function refreshData() {
    const response = await fetch("/api/admin/portal-data", { credentials: "include" });
    const next = (await response.json()) as AdminOverviewData;
    setData(next);
  }

  async function runAction(payload: Record<string, unknown>, successMessage: string) {
    setMessage("");
    setError("");

    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/portal-data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
        const result = (await response.json()) as { error?: string };
        if (!response.ok) {
          throw new Error(result.error || "Unable to update portal data.");
        }
        await refreshData();
        setMessage(successMessage);
      } catch (actionError) {
        setError(actionError instanceof Error ? actionError.message : "Unable to update portal data.");
      }
    });
  }

  return (
    <section className="admin-shell">
      <header className="admin-header">
        <div>
          <p className="admin-eyebrow">Portal Admin</p>
          <h1>Admin Control Center</h1>
          <p className="admin-subtitle">
            Adjust access groups, investor assignments, admin flags, and document visibility from one place.
          </p>
        </div>
        <div className="admin-actions">
          <a href="https://www.dhammacapital.in/dashboard" className="admin-link-button">
            Open member dashboard
          </a>
        </div>
      </header>

      {message ? <div className="admin-banner is-success">{message}</div> : null}
      {error ? <div className="admin-banner is-error">{error}</div> : null}

      <section className="admin-stats">
        <StatCard label="Investors" value={String(data.stats.investors)} helper={`${data.stats.admins} admins`} />
        <StatCard label="Documents" value={String(data.stats.documents)} helper={`${data.stats.globalDocuments} global`} />
        <StatCard label="Access Groups" value={String(data.stats.accessGroups)} helper={`${data.stats.groupedDocuments} grouped docs`} />
        <StatCard label="Categories" value={String(data.stats.categories)} helper="CMS-backed filters" />
      </section>

      <section className="admin-grid">
        <AdminPanel
          title="Access Groups"
          subtitle="Create one shared group, assign several investors to it, and link documents to that same group."
        >
          <form
            className="admin-inline-form"
            onSubmit={(event) => {
              event.preventDefault();
              void runAction(
                {
                  action: "create-access-group",
                  name: groupName,
                },
                "Access group created."
              );
              setGroupName("");
            }}
          >
            <input
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
              placeholder="Create a new access group"
            />
            <button type="submit" disabled={isPending || !groupName.trim()}>
              Create
            </button>
          </form>

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
              {data.accessGroups.length ? data.accessGroups.map((group) => (
                <tr key={group.id}>
                  <td>{group.name}</td>
                  <td>{group.membersCount}</td>
                  <td>{group.documentsCount}</td>
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
          title="Access Rules"
          subtitle="This is the order of document visibility the portal currently applies."
        >
          <div className="admin-rule-list">
            <div className="admin-rule">
              <strong>Global</strong>
              <span>Show To All Members</span>
            </div>
            <div className="admin-rule">
              <strong>Direct</strong>
              <span>Document linked to one investor</span>
            </div>
            <div className="admin-rule">
              <strong>Shared</strong>
              <span>Investor and document share the same Access Group</span>
            </div>
          </div>
        </AdminPanel>
      </section>

      <AdminPanel
        title="Investors"
        subtitle="Assign access groups and admin privileges directly from here."
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
            {data.investors.map((investor) => (
              <tr key={investor.id}>
                <td>{investor.name}</td>
                <td>{investor.email}</td>
                <td>{investor.investorType}</td>
                <td>{investor.status}</td>
                <td>
                  <label className="admin-checkbox">
                    <input
                      type="checkbox"
                      checked={investor.isAdmin}
                      onChange={(event) => {
                        void runAction(
                          {
                            action: "update-investor",
                            investorId: investor.id,
                            isAdmin: event.target.checked,
                            accessGroupId: investor.accessGroupId,
                          },
                          "Investor updated."
                        );
                      }}
                    />
                    <span>{investor.isAdmin ? "Admin" : "Member"}</span>
                  </label>
                </td>
                <td>
                  <select
                    value={investor.accessGroupId}
                    onChange={(event) => {
                      void runAction(
                        {
                          action: "update-investor",
                          investorId: investor.id,
                          isAdmin: investor.isAdmin,
                          accessGroupId: event.target.value,
                        },
                        "Investor updated."
                      );
                    }}
                  >
                    <option value="">No group</option>
                    {data.accessGroups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </AdminPanel>

      <AdminPanel
        title="Documents"
        subtitle="Control document category, global visibility, direct investor access, and shared group access."
      >
        <table className="admin-table">
          <thead>
            <tr>
              <th>Document</th>
              <th>Category</th>
              <th>Global</th>
              <th>Investor</th>
              <th>Access Group</th>
            </tr>
          </thead>
          <tbody>
            {data.documents.map((document) => (
              <tr key={document.id}>
                <td>{document.title}</td>
                <td>
                  <select
                    value={document.categoryId}
                    onChange={(event) => {
                      void runAction(
                        {
                          action: "update-document",
                          documentId: document.id,
                          categoryId: event.target.value,
                          investorId: document.investorId,
                          accessGroupId: document.accessGroupId,
                          showToAllMembers: document.showToAllMembers,
                        },
                        "Document updated."
                      );
                    }}
                  >
                    <option value="">No category</option>
                    {data.categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <label className="admin-checkbox">
                    <input
                      type="checkbox"
                      checked={document.showToAllMembers}
                      onChange={(event) => {
                        void runAction(
                          {
                            action: "update-document",
                            documentId: document.id,
                            categoryId: document.categoryId,
                            investorId: document.investorId,
                            accessGroupId: document.accessGroupId,
                            showToAllMembers: event.target.checked,
                          },
                          "Document updated."
                        );
                      }}
                    />
                    <span>{document.showToAllMembers ? "Global" : "Restricted"}</span>
                  </label>
                </td>
                <td>
                  <select
                    value={document.investorId}
                    onChange={(event) => {
                      void runAction(
                        {
                          action: "update-document",
                          documentId: document.id,
                          categoryId: document.categoryId,
                          investorId: event.target.value,
                          accessGroupId: document.accessGroupId,
                          showToAllMembers: document.showToAllMembers,
                        },
                        "Document updated."
                      );
                    }}
                  >
                    <option value="">No investor</option>
                    {data.investors.map((investor) => (
                      <option key={investor.id} value={investor.id}>
                        {investor.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    value={document.accessGroupId}
                    onChange={(event) => {
                      void runAction(
                        {
                          action: "update-document",
                          documentId: document.id,
                          categoryId: document.categoryId,
                          investorId: document.investorId,
                          accessGroupId: event.target.value,
                          showToAllMembers: document.showToAllMembers,
                        },
                        "Document updated."
                      );
                    }}
                  >
                    <option value="">No group</option>
                    {data.accessGroups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </AdminPanel>
    </section>
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
