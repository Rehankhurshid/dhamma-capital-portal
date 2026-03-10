"use client";

import { useState, useTransition } from "react";
import type { ReactNode } from "react";
import type { AdminOverviewData } from "@/app/lib/admin";

type NamedForm = {
    id: string;
    name: string;
    slug: string;
};

type InvestorForm = {
    id: string;
    name: string;
    slug: string;
    email: string;
    password: string;
    investorType: string;
    status: string;
    isAdmin: boolean;
    accessGroupId: string;
};

type DocumentForm = {
    id: string;
    title: string;
    slug: string;
    fileUrl: string;
    date: string;
    categoryId: string;
    investorId: string;
    accessGroupId: string;
    showToAllMembers: boolean;
};

function slugifyValue(value: string): string {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/&/g, " and ")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function emptyNamedForm(): NamedForm {
    return { id: "", name: "", slug: "" };
}

function emptyInvestorForm(): InvestorForm {
    return {
        id: "",
        name: "",
        slug: "",
        email: "",
        password: "",
        investorType: "dii",
        status: "active",
        isAdmin: false,
        accessGroupId: "",
    };
}

function emptyDocumentForm(): DocumentForm {
    return {
        id: "",
        title: "",
        slug: "",
        fileUrl: "",
        date: "",
        categoryId: "",
        investorId: "",
        accessGroupId: "",
        showToAllMembers: false,
    };
}

export function AdminDashboardClient({ initialData }: { initialData: AdminOverviewData }) {
    const [data, setData] = useState(initialData);
    const [groupForm, setGroupForm] = useState<NamedForm>(emptyNamedForm);
    const [categoryForm, setCategoryForm] = useState<NamedForm>(emptyNamedForm);
    const [investorForm, setInvestorForm] = useState<InvestorForm>(emptyInvestorForm);
    const [documentForm, setDocumentForm] = useState<DocumentForm>(emptyDocumentForm);
    const [taxonomyQuery, setTaxonomyQuery] = useState("");
    const [investorQuery, setInvestorQuery] = useState("");
    const [documentQuery, setDocumentQuery] = useState("");
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [isPending, startTransition] = useTransition();

    async function refreshData() {
        const response = await fetch("/api/admin/portal-data", { credentials: "include" });
        const result = (await response.json()) as AdminOverviewData & { error?: string };
        if (!response.ok) {
            throw new Error(result.error || "Unable to refresh admin data.");
        }
        setData(result);
    }

    async function runAction(
        payload: Record<string, unknown>,
        successMessage: string,
        onDone?: () => void
    ) {
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
                onDone?.();
                setMessage(successMessage);
            } catch (actionError) {
                setError(actionError instanceof Error ? actionError.message : "Unable to update portal data.");
            }
        });
    }

    const normalizedTaxonomyQuery = taxonomyQuery.trim().toLowerCase();
    const filteredGroups = data.accessGroups.filter((group) => {
        if (!normalizedTaxonomyQuery) return true;
        return [group.name, group.slug].some((value) => value.toLowerCase().includes(normalizedTaxonomyQuery));
    });
    const filteredCategories = data.categories.filter((category) => {
        if (!normalizedTaxonomyQuery) return true;
        return [category.name, category.slug].some((value) => value.toLowerCase().includes(normalizedTaxonomyQuery));
    });

    const normalizedInvestorQuery = investorQuery.trim().toLowerCase();
    const filteredInvestors = data.investors.filter((investor) => {
        if (!normalizedInvestorQuery) return true;
        return [investor.name, investor.email, investor.slug, investor.accessGroupName, investor.investorType, investor.status]
            .filter(Boolean)
            .some((value) => value.toLowerCase().includes(normalizedInvestorQuery));
    });

    const normalizedDocumentQuery = documentQuery.trim().toLowerCase();
    const filteredDocuments = data.documents.filter((document) => {
        if (!normalizedDocumentQuery) return true;
        return [
            document.title,
            document.slug,
            document.categoryName,
            document.investorName,
            document.accessGroupName,
            document.fileSizeLabel,
        ]
            .filter(Boolean)
            .some((value) => value.toLowerCase().includes(normalizedDocumentQuery));
    });

    return (
        <section className="admin-shell">
            <header className="admin-header">
                <div>
                    <p className="admin-eyebrow">Portal Admin</p>
                    <h1>Admin Control Center</h1>
                    <p className="admin-subtitle">
                        Manage your live Webflow CMS for members, shared access groups, document categories, and
                        dashboard reports from one place.
                    </p>
                </div>
                <div className="admin-actions">
                    <button
                        type="button"
                        className="admin-secondary-button"
                        onClick={() => void refreshData().catch((refreshError) => {
                            setError(
                                refreshError instanceof Error
                                    ? refreshError.message
                                    : "Unable to refresh admin data."
                            );
                        })}
                        disabled={isPending}
                    >
                        Refresh data
                    </button>
                    <a href="https://www.dhammacapital.in/dashboard" className="admin-link-button">
                        Open member dashboard
                    </a>
                </div>
            </header>

            {message ? <div className="admin-banner is-success">{message}</div> : null}
            {error ? <div className="admin-banner is-error">{error}</div> : null}

            <section className="admin-stats">
                <StatCard label="Investors" value={String(data.stats.investors)} helper={`${data.stats.admins} admins`} />
                <StatCard
                    label="Documents"
                    value={String(data.stats.documents)}
                    helper={`${data.stats.globalDocuments} global`}
                />
                <StatCard
                    label="Access Groups"
                    value={String(data.stats.accessGroups)}
                    helper={`${data.stats.groupedDocuments} grouped docs`}
                />
                <StatCard label="Categories" value={String(data.stats.categories)} helper="CMS-backed filters" />
            </section>

            <section className="admin-grid admin-grid-equal">
                <AdminPanel
                    title="Access Groups"
                    subtitle="Create shared visibility clusters and rename or archive them when needed."
                >
                    <form
                        className="admin-form"
                        onSubmit={(event) => {
                            event.preventDefault();
                            void runAction(
                                {
                                    action: groupForm.id ? "update-access-group" : "create-access-group",
                                    accessGroupId: groupForm.id,
                                    name: groupForm.name,
                                    slug: groupForm.slug,
                                },
                                groupForm.id ? "Access group updated." : "Access group created.",
                                () => setGroupForm(emptyNamedForm)
                            );
                        }}
                    >
                        <div className="admin-form-grid admin-form-grid-2">
                            <Field label="Group name">
                                <input
                                    value={groupForm.name}
                                    onChange={(event) =>
                                        setGroupForm((current) => ({
                                            ...current,
                                            name: event.target.value,
                                            slug: current.slug || slugifyValue(event.target.value),
                                        }))
                                    }
                                    placeholder="Founder Circle"
                                />
                            </Field>
                            <Field label="Slug">
                                <div className="admin-inline-input">
                                    <input
                                        value={groupForm.slug}
                                        onChange={(event) =>
                                            setGroupForm((current) => ({ ...current, slug: event.target.value }))
                                        }
                                        placeholder="founder-circle"
                                    />
                                    <button
                                        type="button"
                                        className="admin-tertiary-button"
                                        onClick={() =>
                                            setGroupForm((current) => ({
                                                ...current,
                                                slug: slugifyValue(current.name),
                                            }))
                                        }
                                    >
                                        Auto
                                    </button>
                                </div>
                            </Field>
                        </div>
                        <div className="admin-action-row">
                            <button type="submit" disabled={isPending || !groupForm.name.trim()}>
                                {groupForm.id ? "Update group" : "Create group"}
                            </button>
                            {groupForm.id ? (
                                <button
                                    type="button"
                                    className="admin-secondary-button"
                                    onClick={() => setGroupForm(emptyNamedForm)}
                                >
                                    Cancel
                                </button>
                            ) : null}
                        </div>
                    </form>

                    <div className="admin-section-toolbar">
                        <input
                            value={taxonomyQuery}
                            onChange={(event) => setTaxonomyQuery(event.target.value)}
                            placeholder="Search groups and categories"
                        />
                    </div>

                    <div className="admin-table-wrap">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Group</th>
                                    <th>Members</th>
                                    <th>Docs</th>
                                    <th>Slug</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredGroups.length ? (
                                    filteredGroups.map((group) => (
                                        <tr key={group.id}>
                                            <td>
                                                <div className="admin-cell-stack">
                                                    <strong>{group.name}</strong>
                                                </div>
                                            </td>
                                            <td>{group.membersCount}</td>
                                            <td>{group.documentsCount}</td>
                                            <td>{group.slug}</td>
                                            <td>
                                                <div className="admin-row-actions">
                                                    <button
                                                        type="button"
                                                        className="admin-tertiary-button"
                                                        onClick={() =>
                                                            setGroupForm({
                                                                id: group.id,
                                                                name: group.name,
                                                                slug: group.slug,
                                                            })
                                                        }
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="admin-danger-button"
                                                        onClick={() => {
                                                            if (
                                                                window.confirm(
                                                                    `Archive access group "${group.name}"?`
                                                                )
                                                            ) {
                                                                void runAction(
                                                                    {
                                                                        action: "archive-access-group",
                                                                        accessGroupId: group.id,
                                                                    },
                                                                    "Access group archived.",
                                                                    () => {
                                                                        if (groupForm.id === group.id) {
                                                                            setGroupForm(emptyNamedForm);
                                                                        }
                                                                    }
                                                                );
                                                            }
                                                        }}
                                                    >
                                                        Archive
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={5}>No access groups match the current filter.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </AdminPanel>

                <AdminPanel
                    title="Categories"
                    subtitle="Keep dashboard filter pills and report organization aligned with CMS categories."
                >
                    <form
                        className="admin-form"
                        onSubmit={(event) => {
                            event.preventDefault();
                            void runAction(
                                {
                                    action: categoryForm.id ? "update-category" : "create-category",
                                    categoryId: categoryForm.id,
                                    name: categoryForm.name,
                                    slug: categoryForm.slug,
                                },
                                categoryForm.id ? "Category updated." : "Category created.",
                                () => setCategoryForm(emptyNamedForm)
                            );
                        }}
                    >
                        <div className="admin-form-grid admin-form-grid-2">
                            <Field label="Category name">
                                <input
                                    value={categoryForm.name}
                                    onChange={(event) =>
                                        setCategoryForm((current) => ({
                                            ...current,
                                            name: event.target.value,
                                            slug: current.slug || slugifyValue(event.target.value),
                                        }))
                                    }
                                    placeholder="Quarterly Reports"
                                />
                            </Field>
                            <Field label="Slug">
                                <div className="admin-inline-input">
                                    <input
                                        value={categoryForm.slug}
                                        onChange={(event) =>
                                            setCategoryForm((current) => ({ ...current, slug: event.target.value }))
                                        }
                                        placeholder="quarterly-reports"
                                    />
                                    <button
                                        type="button"
                                        className="admin-tertiary-button"
                                        onClick={() =>
                                            setCategoryForm((current) => ({
                                                ...current,
                                                slug: slugifyValue(current.name),
                                            }))
                                        }
                                    >
                                        Auto
                                    </button>
                                </div>
                            </Field>
                        </div>
                        <div className="admin-action-row">
                            <button type="submit" disabled={isPending || !categoryForm.name.trim()}>
                                {categoryForm.id ? "Update category" : "Create category"}
                            </button>
                            {categoryForm.id ? (
                                <button
                                    type="button"
                                    className="admin-secondary-button"
                                    onClick={() => setCategoryForm(emptyNamedForm)}
                                >
                                    Cancel
                                </button>
                            ) : null}
                        </div>
                    </form>

                    <div className="admin-table-wrap">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Category</th>
                                    <th>Slug</th>
                                    <th>Docs</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredCategories.length ? (
                                    filteredCategories.map((category) => (
                                        <tr key={category.id}>
                                            <td>{category.name}</td>
                                            <td>{category.slug}</td>
                                            <td>{category.documentsCount}</td>
                                            <td>
                                                <div className="admin-row-actions">
                                                    <button
                                                        type="button"
                                                        className="admin-tertiary-button"
                                                        onClick={() =>
                                                            setCategoryForm({
                                                                id: category.id,
                                                                name: category.name,
                                                                slug: category.slug,
                                                            })
                                                        }
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="admin-danger-button"
                                                        onClick={() => {
                                                            if (
                                                                window.confirm(
                                                                    `Archive category "${category.name}"?`
                                                                )
                                                            ) {
                                                                void runAction(
                                                                    {
                                                                        action: "archive-category",
                                                                        categoryId: category.id,
                                                                    },
                                                                    "Category archived.",
                                                                    () => {
                                                                        if (categoryForm.id === category.id) {
                                                                            setCategoryForm(emptyNamedForm);
                                                                        }
                                                                    }
                                                                );
                                                            }
                                                        }}
                                                    >
                                                        Archive
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={4}>No categories match the current filter.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </AdminPanel>
            </section>

            <AdminPanel
                title="Investors"
                subtitle="Create portal users, adjust investor type and status, set admin access, and map them into groups."
            >
                <form
                    className="admin-form"
                    onSubmit={(event) => {
                        event.preventDefault();
                        void runAction(
                            {
                                action: investorForm.id ? "update-investor" : "create-investor",
                                investorId: investorForm.id,
                                name: investorForm.name,
                                slug: investorForm.slug,
                                email: investorForm.email,
                                password: investorForm.password,
                                investorType: investorForm.investorType,
                                status: investorForm.status,
                                isAdmin: investorForm.isAdmin,
                                accessGroupId: investorForm.accessGroupId,
                            },
                            investorForm.id ? "Investor updated." : "Investor created.",
                            () => setInvestorForm(emptyInvestorForm)
                        );
                    }}
                >
                    <div className="admin-form-grid admin-form-grid-3">
                        <Field label="Name">
                            <input
                                value={investorForm.name}
                                onChange={(event) =>
                                    setInvestorForm((current) => ({
                                        ...current,
                                        name: event.target.value,
                                        slug: current.slug || slugifyValue(event.target.value),
                                    }))
                                }
                                placeholder="Investor name"
                            />
                        </Field>
                        <Field label="Slug">
                            <div className="admin-inline-input">
                                <input
                                    value={investorForm.slug}
                                    onChange={(event) =>
                                        setInvestorForm((current) => ({ ...current, slug: event.target.value }))
                                    }
                                    placeholder="investor-name"
                                />
                                <button
                                    type="button"
                                    className="admin-tertiary-button"
                                    onClick={() =>
                                        setInvestorForm((current) => ({
                                            ...current,
                                            slug: slugifyValue(current.name),
                                        }))
                                    }
                                >
                                    Auto
                                </button>
                            </div>
                        </Field>
                        <Field label="Email">
                            <input
                                type="email"
                                value={investorForm.email}
                                onChange={(event) =>
                                    setInvestorForm((current) => ({ ...current, email: event.target.value }))
                                }
                                placeholder="investor@domain.com"
                            />
                        </Field>
                        <Field label={investorForm.id ? "New password (optional)" : "Password"}>
                            <input
                                type="text"
                                value={investorForm.password}
                                onChange={(event) =>
                                    setInvestorForm((current) => ({ ...current, password: event.target.value }))
                                }
                                placeholder={investorForm.id ? "Leave blank to keep current password" : "Minimum 8 characters"}
                            />
                        </Field>
                        <Field label="Investor type">
                            <select
                                value={investorForm.investorType}
                                onChange={(event) =>
                                    setInvestorForm((current) => ({
                                        ...current,
                                        investorType: event.target.value,
                                    }))
                                }
                            >
                                <option value="dii">DII</option>
                                <option value="fii">FII</option>
                            </select>
                        </Field>
                        <Field label="Status">
                            <select
                                value={investorForm.status}
                                onChange={(event) =>
                                    setInvestorForm((current) => ({ ...current, status: event.target.value }))
                                }
                            >
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </Field>
                        <Field label="Access group">
                            <select
                                value={investorForm.accessGroupId}
                                onChange={(event) =>
                                    setInvestorForm((current) => ({
                                        ...current,
                                        accessGroupId: event.target.value,
                                    }))
                                }
                            >
                                <option value="">No group</option>
                                {data.accessGroups.map((group) => (
                                    <option key={group.id} value={group.id}>
                                        {group.name}
                                    </option>
                                ))}
                            </select>
                        </Field>
                        <Field label="Admin access">
                            <label className="admin-checkbox admin-checkbox-box">
                                <input
                                    type="checkbox"
                                    checked={investorForm.isAdmin}
                                    onChange={(event) =>
                                        setInvestorForm((current) => ({
                                            ...current,
                                            isAdmin: event.target.checked,
                                        }))
                                    }
                                />
                                <span>Grant admin rights to this investor</span>
                            </label>
                        </Field>
                    </div>
                    <div className="admin-action-row">
                        <button
                            type="submit"
                            disabled={
                                isPending ||
                                !investorForm.name.trim() ||
                                !investorForm.email.trim() ||
                                (!investorForm.id && !investorForm.password.trim())
                            }
                        >
                            {investorForm.id ? "Update investor" : "Create investor"}
                        </button>
                        {investorForm.id ? (
                            <button
                                type="button"
                                className="admin-secondary-button"
                                onClick={() => setInvestorForm(emptyInvestorForm)}
                            >
                                Cancel
                            </button>
                        ) : null}
                    </div>
                </form>

                <div className="admin-section-toolbar">
                    <input
                        value={investorQuery}
                        onChange={(event) => setInvestorQuery(event.target.value)}
                        placeholder="Search investors by name, email, type, status, or group"
                    />
                    <div className="admin-toolbar-meta">{filteredInvestors.length} investor records</div>
                </div>

                <div className="admin-table-wrap">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Investor</th>
                                <th>Type</th>
                                <th>Status</th>
                                <th>Admin</th>
                                <th>Access Group</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredInvestors.length ? (
                                filteredInvestors.map((investor) => (
                                    <tr key={investor.id}>
                                        <td>
                                            <div className="admin-cell-stack">
                                                <strong>{investor.name}</strong>
                                                <span>{investor.email}</span>
                                                <span>{investor.slug}</span>
                                            </div>
                                        </td>
                                        <td>{investor.investorType}</td>
                                        <td>
                                            <span className={`admin-pill ${investor.isActive ? "is-success" : "is-muted"}`}>
                                                {investor.status}
                                            </span>
                                        </td>
                                        <td>{investor.isAdmin ? "Yes" : "No"}</td>
                                        <td>{investor.accessGroupName || "No group"}</td>
                                        <td>
                                            <div className="admin-row-actions">
                                                <button
                                                    type="button"
                                                    className="admin-tertiary-button"
                                                    onClick={() =>
                                                        setInvestorForm({
                                                            id: investor.id,
                                                            name: investor.name,
                                                            slug: investor.slug,
                                                            email: investor.email,
                                                            password: "",
                                                            investorType: investor.investorType.toLowerCase(),
                                                            status: investor.isActive ? "active" : "inactive",
                                                            isAdmin: investor.isAdmin,
                                                            accessGroupId: investor.accessGroupId,
                                                        })
                                                    }
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    type="button"
                                                    className="admin-danger-button"
                                                    onClick={() => {
                                                        if (
                                                            window.confirm(
                                                                `Archive investor "${investor.name}"?`
                                                            )
                                                        ) {
                                                            void runAction(
                                                                {
                                                                    action: "archive-investor",
                                                                    investorId: investor.id,
                                                                },
                                                                "Investor archived.",
                                                                () => {
                                                                    if (investorForm.id === investor.id) {
                                                                        setInvestorForm(emptyInvestorForm);
                                                                    }
                                                                }
                                                            );
                                                        }
                                                    }}
                                                >
                                                    Archive
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6}>No investors match the current filter.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </AdminPanel>

            <AdminPanel
                title="Documents"
                subtitle="Create new dashboard reports, import files from public URLs, and manage visibility rules without leaving the admin panel."
            >
                <form
                    className="admin-form"
                    onSubmit={(event) => {
                        event.preventDefault();
                        void runAction(
                            {
                                action: documentForm.id ? "update-document" : "create-document",
                                documentId: documentForm.id,
                                title: documentForm.title,
                                slug: documentForm.slug,
                                fileUrl: documentForm.fileUrl,
                                date: documentForm.date,
                                categoryId: documentForm.categoryId,
                                investorId: documentForm.investorId,
                                accessGroupId: documentForm.accessGroupId,
                                showToAllMembers: documentForm.showToAllMembers,
                            },
                            documentForm.id ? "Document updated." : "Document created.",
                            () => setDocumentForm(emptyDocumentForm)
                        );
                    }}
                >
                    <div className="admin-form-grid admin-form-grid-3">
                        <Field label="Document title">
                            <input
                                value={documentForm.title}
                                onChange={(event) =>
                                    setDocumentForm((current) => ({
                                        ...current,
                                        title: event.target.value,
                                        slug: current.slug || slugifyValue(event.target.value),
                                    }))
                                }
                                placeholder="Q4 FY2025 Investor Letter"
                            />
                        </Field>
                        <Field label="Slug">
                            <div className="admin-inline-input">
                                <input
                                    value={documentForm.slug}
                                    onChange={(event) =>
                                        setDocumentForm((current) => ({ ...current, slug: event.target.value }))
                                    }
                                    placeholder="q4-fy2025-investor-letter"
                                />
                                <button
                                    type="button"
                                    className="admin-tertiary-button"
                                    onClick={() =>
                                        setDocumentForm((current) => ({
                                            ...current,
                                            slug: slugifyValue(current.title),
                                        }))
                                    }
                                >
                                    Auto
                                </button>
                            </div>
                        </Field>
                        <Field label="Document date">
                            <input
                                type="date"
                                value={documentForm.date}
                                onChange={(event) =>
                                    setDocumentForm((current) => ({ ...current, date: event.target.value }))
                                }
                            />
                        </Field>
                        <Field label={documentForm.id ? "Public file URL" : "Public file URL (required)"}>
                            <input
                                type="url"
                                value={documentForm.fileUrl}
                                onChange={(event) =>
                                    setDocumentForm((current) => ({ ...current, fileUrl: event.target.value }))
                                }
                                placeholder="https://example.com/report.pdf"
                            />
                        </Field>
                        <Field label="Category">
                            <select
                                value={documentForm.categoryId}
                                onChange={(event) =>
                                    setDocumentForm((current) => ({
                                        ...current,
                                        categoryId: event.target.value,
                                    }))
                                }
                            >
                                <option value="">No category</option>
                                {data.categories.map((category) => (
                                    <option key={category.id} value={category.id}>
                                        {category.name}
                                    </option>
                                ))}
                            </select>
                        </Field>
                        <Field label="Direct investor access">
                            <select
                                value={documentForm.investorId}
                                onChange={(event) =>
                                    setDocumentForm((current) => ({
                                        ...current,
                                        investorId: event.target.value,
                                    }))
                                }
                            >
                                <option value="">No direct investor</option>
                                {data.investors.map((investor) => (
                                    <option key={investor.id} value={investor.id}>
                                        {investor.name}
                                    </option>
                                ))}
                            </select>
                        </Field>
                        <Field label="Access group">
                            <select
                                value={documentForm.accessGroupId}
                                onChange={(event) =>
                                    setDocumentForm((current) => ({
                                        ...current,
                                        accessGroupId: event.target.value,
                                    }))
                                }
                            >
                                <option value="">No group</option>
                                {data.accessGroups.map((group) => (
                                    <option key={group.id} value={group.id}>
                                        {group.name}
                                    </option>
                                ))}
                            </select>
                        </Field>
                        <Field label="Visibility">
                            <label className="admin-checkbox admin-checkbox-box">
                                <input
                                    type="checkbox"
                                    checked={documentForm.showToAllMembers}
                                    onChange={(event) =>
                                        setDocumentForm((current) => ({
                                            ...current,
                                            showToAllMembers: event.target.checked,
                                        }))
                                    }
                                />
                                <span>Show this document to all members</span>
                            </label>
                        </Field>
                    </div>
                    <p className="admin-form-note">
                        Files are imported into the Webflow CMS from a public URL. If you update an existing document,
                        leave the current URL in place or replace it with a new public file URL.
                    </p>
                    <div className="admin-action-row">
                        <button
                            type="submit"
                            disabled={
                                isPending ||
                                !documentForm.title.trim() ||
                                (!documentForm.id && !documentForm.fileUrl.trim())
                            }
                        >
                            {documentForm.id ? "Update document" : "Create document"}
                        </button>
                        {documentForm.id ? (
                            <button
                                type="button"
                                className="admin-secondary-button"
                                onClick={() => setDocumentForm(emptyDocumentForm)}
                            >
                                Cancel
                            </button>
                        ) : null}
                    </div>
                </form>

                <div className="admin-section-toolbar">
                    <input
                        value={documentQuery}
                        onChange={(event) => setDocumentQuery(event.target.value)}
                        placeholder="Search documents by title, category, investor, group, or slug"
                    />
                    <div className="admin-toolbar-meta">{filteredDocuments.length} live documents</div>
                </div>

                <div className="admin-table-wrap">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Document</th>
                                <th>Visibility</th>
                                <th>Category</th>
                                <th>Investor</th>
                                <th>Access Group</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredDocuments.length ? (
                                filteredDocuments.map((document) => (
                                    <tr key={document.id}>
                                        <td>
                                            <div className="admin-cell-stack">
                                                <strong>{document.title}</strong>
                                                <span>{document.slug}</span>
                                                <span>{document.date || "No date"}</span>
                                                {document.fileUrl ? (
                                                    <a
                                                        className="admin-inline-link"
                                                        href={document.fileUrl}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                    >
                                                        Open source file
                                                    </a>
                                                ) : null}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="admin-cell-stack">
                                                <span className={`admin-pill ${document.showToAllMembers ? "is-success" : "is-muted"}`}>
                                                    {document.showToAllMembers ? "All members" : "Restricted"}
                                                </span>
                                                {document.fileSizeLabel ? <span>{document.fileSizeLabel}</span> : null}
                                            </div>
                                        </td>
                                        <td>{document.categoryName}</td>
                                        <td>{document.investorName || "No direct investor"}</td>
                                        <td>{document.accessGroupName || "No group"}</td>
                                        <td>
                                            <div className="admin-row-actions">
                                                <button
                                                    type="button"
                                                    className="admin-tertiary-button"
                                                    onClick={() =>
                                                        setDocumentForm({
                                                            id: document.id,
                                                            title: document.title,
                                                            slug: document.slug,
                                                            fileUrl: document.fileUrl,
                                                            date: document.date,
                                                            categoryId: document.categoryId,
                                                            investorId: document.investorId,
                                                            accessGroupId: document.accessGroupId,
                                                            showToAllMembers: document.showToAllMembers,
                                                        })
                                                    }
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    type="button"
                                                    className="admin-danger-button"
                                                    onClick={() => {
                                                        if (
                                                            window.confirm(
                                                                `Archive document "${document.title}"?`
                                                            )
                                                        ) {
                                                            void runAction(
                                                                {
                                                                    action: "archive-document",
                                                                    documentId: document.id,
                                                                },
                                                                "Document archived.",
                                                                () => {
                                                                    if (documentForm.id === document.id) {
                                                                        setDocumentForm(emptyDocumentForm);
                                                                    }
                                                                }
                                                            );
                                                        }
                                                    }}
                                                >
                                                    Archive
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6}>No documents match the current filter.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </AdminPanel>

            <section className="admin-grid">
                <AdminPanel
                    title="Access Model"
                    subtitle="This is the order of visibility the member dashboard currently applies."
                >
                    <div className="admin-rule-list">
                        <div className="admin-rule">
                            <strong>Global</strong>
                            <span>Show To All Members is enabled on the document</span>
                        </div>
                        <div className="admin-rule">
                            <strong>Direct</strong>
                            <span>The document is linked to a single investor</span>
                        </div>
                        <div className="admin-rule">
                            <strong>Shared</strong>
                            <span>Investor and document share the same Access Group</span>
                        </div>
                    </div>
                </AdminPanel>

                <AdminPanel
                    title="Operational Notes"
                    subtitle="A few guardrails so edits stay predictable in production."
                >
                    <div className="admin-note-list">
                        <div className="admin-note">
                            Archived items disappear from this admin view because only live CMS entries are loaded.
                        </div>
                        <div className="admin-note">
                            Password changes here are published live, so investors can sign in with the new password
                            immediately.
                        </div>
                        <div className="admin-note">
                            Document creation expects a public file URL so Webflow can import the file into the Report
                            File field.
                        </div>
                    </div>
                </AdminPanel>
            </section>
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
    children: ReactNode;
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

function Field({ label, children }: { label: string; children: ReactNode }) {
    return (
        <label className="admin-field">
            <span>{label}</span>
            {children}
        </label>
    );
}

function StatCard({ label, value, helper }: { label: string; value: string; helper: string }) {
    return (
        <article className="admin-stat-card">
            <p>{label}</p>
            <strong>{value}</strong>
            <span>{helper}</span>
        </article>
    );
}
