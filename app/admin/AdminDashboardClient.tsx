"use client";

import { useState, useTransition } from "react";
import type { AdminOverviewData } from "@/app/lib/admin";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

/* ─── Types ──────────────────────────────────────────────────────────────── */

type NamedForm = { id: string; name: string; slug: string };
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

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function slugifyValue(value: string): string {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/&/g, " and ")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

const emptyNamed = (): NamedForm => ({ id: "", name: "", slug: "" });
const emptyInvestor = (): InvestorForm => ({
    id: "", name: "", slug: "", email: "", password: "",
    investorType: "dii", status: "active", isAdmin: false, accessGroupId: "",
});
const emptyDocument = (): DocumentForm => ({
    id: "", title: "", slug: "", fileUrl: "", date: "",
    categoryId: "", investorId: "", accessGroupId: "", showToAllMembers: false,
});

/* ─── Icons (inline SVG to avoid an extra dep) ───────────────────────────── */

function IconUsers({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} width="20" height="20">
            <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4-4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
        </svg>
    );
}
function IconFile({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} width="20" height="20">
            <path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" />
        </svg>
    );
}
function IconLayers({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} width="20" height="20">
            <polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" />
        </svg>
    );
}
function IconTag({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} width="20" height="20">
            <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
        </svg>
    );
}
function IconRefresh({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} width="16" height="16">
            <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0114.13-3.36L23 10M1 14l5.36 4.85A9 9 0 0020.49 15" />
        </svg>
    );
}
function IconExternalLink({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} width="14" height="14">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
        </svg>
    );
}
function IconCheck({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} width="14" height="14">
            <polyline points="20 6 9 17 4 12" />
        </svg>
    );
}
function IconAlertCircle({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} width="16" height="16">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
    );
}
function IconSearch({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} width="16" height="16">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
    );
}
function IconShield({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} width="16" height="16">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
    );
}
function IconInfo({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} width="16" height="16">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
    );
}

/* ─── Main Component ─────────────────────────────────────────────────────── */

export function AdminDashboardClient({ initialData }: { initialData: AdminOverviewData }) {
    const [data, setData] = useState(initialData);
    const [groupForm, setGroupForm] = useState<NamedForm>(emptyNamed);
    const [categoryForm, setCategoryForm] = useState<NamedForm>(emptyNamed);
    const [investorForm, setInvestorForm] = useState<InvestorForm>(emptyInvestor);
    const [documentForm, setDocumentForm] = useState<DocumentForm>(emptyDocument);
    const [taxonomyQuery, setTaxonomyQuery] = useState("");
    const [investorQuery, setInvestorQuery] = useState("");
    const [documentQuery, setDocumentQuery] = useState("");
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [isPending, startTransition] = useTransition();
    const [selectedInvestors, setSelectedInvestors] = useState<Set<string>>(new Set());
    const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
    const [bulkInvGroup, setBulkInvGroup] = useState("");
    const [bulkInvStatus, setBulkInvStatus] = useState("");
    const [bulkDocGroup, setBulkDocGroup] = useState("");
    const [bulkDocCategory, setBulkDocCategory] = useState("");

    function toggleSelection(set: Set<string>, setFn: (s: Set<string>) => void, id: string) {
        const next = new Set(set);
        if (next.has(id)) next.delete(id); else next.add(id);
        setFn(next);
    }
    function toggleAll(ids: string[], set: Set<string>, setFn: (s: Set<string>) => void) {
        const allSelected = ids.length > 0 && ids.every(id => set.has(id));
        setFn(allSelected ? new Set() : new Set(ids));
    }
    async function runBulkActions(ids: string[], makePayload: (id: string) => Record<string, unknown>, label: string, clearFn: () => void) {
        setMessage(""); setError("");
        startTransition(async () => {
            try {
                for (const id of ids) {
                    const res = await fetch("/api/admin/portal-data", {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        credentials: "include", body: JSON.stringify(makePayload(id)),
                    });
                    const result = (await res.json()) as { error?: string };
                    if (!res.ok) throw new Error(result.error || "Bulk action failed.");
                }
                await refreshData();
                clearFn();
                setMessage(`${label} — ${ids.length} item(s) updated.`);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Bulk action failed.");
            }
        });
    }

    /* ── API helpers ─────────────────────────────────────────────────────── */

    async function refreshData() {
        const res = await fetch("/api/admin/portal-data", { credentials: "include" });
        const result = (await res.json()) as AdminOverviewData & { error?: string };
        if (!res.ok) throw new Error(result.error || "Unable to refresh data.");
        setData(result);
    }

    async function runAction(payload: Record<string, unknown>, successMsg: string, onDone?: () => void) {
        setMessage("");
        setError("");
        startTransition(async () => {
            try {
                const res = await fetch("/api/admin/portal-data", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    credentials: "include", body: JSON.stringify(payload),
                });
                const result = (await res.json()) as { error?: string };
                if (!res.ok) throw new Error(result.error || "Unable to update data.");
                await refreshData();
                onDone?.();
                setMessage(successMsg);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Unable to update data.");
            }
        });
    }

    /* ── Filters ─────────────────────────────────────────────────────────── */

    const tq = taxonomyQuery.trim().toLowerCase();
    const filteredGroups = data.accessGroups.filter(g => !tq || [g.name, g.slug].some(v => v.toLowerCase().includes(tq)));
    const filteredCategories = data.categories.filter(c => !tq || [c.name, c.slug].some(v => v.toLowerCase().includes(tq)));

    const iq = investorQuery.trim().toLowerCase();
    const filteredInvestors = data.investors.filter(i => !iq || [i.name, i.email, i.slug, i.accessGroupName, i.investorType, i.status].filter(Boolean).some(v => v.toLowerCase().includes(iq)));

    const dq = documentQuery.trim().toLowerCase();
    const filteredDocuments = data.documents.filter(d => !dq || [d.title, d.slug, d.categoryName, d.investorName, d.accessGroupName, d.fileSizeLabel].filter(Boolean).some(v => v.toLowerCase().includes(dq)));

    /* ── Render ───────────────────────────────────────────────────────────── */

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
            {/* ─── Top chrome ────────────────────────────────────────────── */}
            <div className="border-b border-slate-200/80 bg-white/70 backdrop-blur-xl sticky top-0 z-30">
                <div className="mx-auto max-w-[1400px] px-6 py-4 flex items-center justify-between gap-4">
                    <div>
                        <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-blue-600/80 mb-1">Portal Admin</p>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Control Center</h1>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void refreshData().catch(err => setError(err instanceof Error ? err.message : "Unable to refresh."))}
                            disabled={isPending}
                            className="gap-2"
                        >
                            <IconRefresh className={isPending ? "animate-spin" : ""} />
                            Refresh
                        </Button>
                        <a href="https://www.dhammacapital.in/dashboard" target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium h-8 px-3 no-underline hover:no-underline">
                            Member Dashboard
                            <IconExternalLink />
                        </a>
                    </div>
                </div>
            </div>

            <div className="mx-auto max-w-[1400px] px-6 py-6 space-y-6">
                {/* ─── Notifications ─────────────────────────────────────── */}
                {message && (
                    <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800 animate-in slide-in-from-top-2 duration-300">
                        <IconCheck className="text-emerald-600" />
                        <AlertDescription className="font-medium">{message}</AlertDescription>
                    </Alert>
                )}
                {error && (
                    <Alert variant="destructive" className="animate-in slide-in-from-top-2 duration-300">
                        <IconAlertCircle />
                        <AlertDescription className="font-medium">{error}</AlertDescription>
                    </Alert>
                )}

                {/* ─── Stats row ─────────────────────────────────────────── */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard icon={<IconUsers className="text-blue-500" />} label="Investors" value={data.stats.investors} helper={`${data.stats.admins} admins`} accent="blue" />
                    <StatCard icon={<IconFile className="text-violet-500" />} label="Documents" value={data.stats.documents} helper={`${data.stats.globalDocuments} global`} accent="violet" />
                    <StatCard icon={<IconLayers className="text-amber-500" />} label="Access Groups" value={data.stats.accessGroups} helper={`${data.stats.groupedDocuments} grouped docs`} accent="amber" />
                    <StatCard icon={<IconTag className="text-emerald-500" />} label="Categories" value={data.stats.categories} helper="CMS-backed filters" accent="emerald" />
                </div>

                {/* ─── Main tabs ──────────────────────────────────────────── */}
                <Tabs defaultValue="investors" className="space-y-4">
                    <div className="flex items-center gap-4">
                        <TabsList className="bg-slate-100/80">
                            <TabsTrigger value="investors" className="gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                <IconUsers className="opacity-60" />
                                Investors
                            </TabsTrigger>
                            <TabsTrigger value="documents" className="gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                <IconFile className="opacity-60" />
                                Documents
                            </TabsTrigger>
                            <TabsTrigger value="taxonomy" className="gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                <IconLayers className="opacity-60" />
                                Groups & Categories
                            </TabsTrigger>
                            <TabsTrigger value="info" className="gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                <IconInfo className="opacity-60" />
                                Reference
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    {/* ═══════════════ INVESTORS TAB ═══════════════════════ */}
                    <TabsContent value="investors" className="space-y-4">
                        <Card className="border-slate-200/80 shadow-sm">
                            <CardHeader>
                                <CardTitle className="text-lg">{investorForm.id ? "Edit Investor" : "Create Investor"}</CardTitle>
                                <CardDescription>
                                    {investorForm.id
                                        ? "Update the selected investor's details below."
                                        : "Add a new portal user with access credentials and group assignment."}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form
                                    onSubmit={e => {
                                        e.preventDefault();
                                        void runAction(
                                            {
                                                action: investorForm.id ? "update-investor" : "create-investor",
                                                investorId: investorForm.id,
                                                name: investorForm.name, slug: investorForm.slug,
                                                email: investorForm.email, password: investorForm.password,
                                                investorType: investorForm.investorType, status: investorForm.status,
                                                isAdmin: investorForm.isAdmin, accessGroupId: investorForm.accessGroupId,
                                            },
                                            investorForm.id ? "Investor updated." : "Investor created.",
                                            () => setInvestorForm(emptyInvestor),
                                        );
                                    }}
                                    className="space-y-5"
                                >
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                        <FieldGroup label="Name">
                                            <Input value={investorForm.name} onChange={e => setInvestorForm(c => ({ ...c, name: e.target.value, slug: c.slug || slugifyValue(e.target.value) }))} placeholder="Investor name" />
                                        </FieldGroup>
                                        <FieldGroup label="Slug">
                                            <div className="flex gap-2">
                                                <Input value={investorForm.slug} onChange={e => setInvestorForm(c => ({ ...c, slug: e.target.value }))} placeholder="investor-name" className="flex-1" />
                                                <Button type="button" variant="outline" size="sm" className="shrink-0 h-9 px-3 text-xs" onClick={() => setInvestorForm(c => ({ ...c, slug: slugifyValue(c.name) }))}>Auto</Button>
                                            </div>
                                        </FieldGroup>
                                        <FieldGroup label="Email">
                                            <Input type="email" value={investorForm.email} onChange={e => setInvestorForm(c => ({ ...c, email: e.target.value }))} placeholder="investor@domain.com" />
                                        </FieldGroup>
                                        <FieldGroup label={investorForm.id ? "New Password (optional)" : "Password"}>
                                            <Input type="text" value={investorForm.password} onChange={e => setInvestorForm(c => ({ ...c, password: e.target.value }))} placeholder={investorForm.id ? "Leave blank to keep current" : "Min 8 characters"} />
                                        </FieldGroup>
                                        <FieldGroup label="Investor Type">
                                            <Select value={investorForm.investorType} onValueChange={v => setInvestorForm(c => ({ ...c, investorType: v ?? '' }))}>
                                                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="dii">DII</SelectItem>
                                                    <SelectItem value="fii">FII</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </FieldGroup>
                                        <FieldGroup label="Status">
                                            <Select value={investorForm.status} onValueChange={v => setInvestorForm(c => ({ ...c, status: v ?? '' }))}>
                                                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="active">Active</SelectItem>
                                                    <SelectItem value="inactive">Inactive</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </FieldGroup>
                                        <FieldGroup label="Access Group">
                                            <Select value={investorForm.accessGroupId || "__none__"} onValueChange={v => setInvestorForm(c => ({ ...c, accessGroupId: v === "__none__" ? "" : (v ?? '') }))}>
                                                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="__none__">No group</SelectItem>
                                                    {data.accessGroups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </FieldGroup>
                                        <FieldGroup label="Admin Access">
                                            <div className="flex items-center gap-2 h-9 px-3 border rounded-md bg-white">
                                                <Checkbox
                                                    id="investorAdmin"
                                                    checked={investorForm.isAdmin}
                                                    onCheckedChange={v => setInvestorForm(c => ({ ...c, isAdmin: Boolean(v) }))}
                                                />
                                                <Label htmlFor="investorAdmin" className="text-sm font-normal cursor-pointer">Grant admin rights</Label>
                                            </div>
                                        </FieldGroup>
                                    </div>
                                    <div className="flex gap-3">
                                        <Button type="submit" disabled={isPending || !investorForm.name.trim() || !investorForm.email.trim() || (!investorForm.id && !investorForm.password.trim())} className="bg-slate-900 hover:bg-slate-800">
                                            {investorForm.id ? "Update Investor" : "Create Investor"}
                                        </Button>
                                        {investorForm.id && (
                                            <Button type="button" variant="ghost" onClick={() => setInvestorForm(emptyInvestor)}>Cancel</Button>
                                        )}
                                    </div>
                                </form>
                            </CardContent>
                        </Card>

                        <Card className="border-slate-200/80 shadow-sm">
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between gap-4">
                                    <CardTitle className="text-lg">All Investors</CardTitle>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Badge variant="secondary" className="font-mono">{filteredInvestors.length}</Badge>
                                        records
                                    </div>
                                </div>
                                <div className="relative mt-2">
                                    <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                    <Input value={investorQuery} onChange={e => setInvestorQuery(e.target.value)} placeholder="Search by name, email, type, status, or group…" className="pl-9 h-9" />
                                </div>
                            </CardHeader>
                            {/* ── Bulk actions bar ── */}
                            {selectedInvestors.size > 0 && (
                                <div className="mx-4 mb-3 p-3 rounded-lg bg-blue-50 border border-blue-200 flex flex-wrap items-center gap-3 animate-in slide-in-from-top-1 duration-200">
                                    <Badge className="bg-blue-600 text-white hover:bg-blue-600">{selectedInvestors.size} selected</Badge>
                                    <Separator orientation="vertical" className="h-5" />
                                    <div className="flex items-center gap-2">
                                        <Select value={bulkInvGroup} onValueChange={v => setBulkInvGroup(v ?? '')}>
                                            <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue placeholder="Assign Group" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="__none__">No group</SelectItem>
                                                {data.accessGroups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        <Button size="sm" variant="outline" className="h-8 text-xs" disabled={!bulkInvGroup || isPending} onClick={() => {
                                            const ids = [...selectedInvestors];
                                            void runBulkActions(ids, id => ({ action: "update-investor", investorId: id, accessGroupId: bulkInvGroup === "__none__" ? "" : bulkInvGroup }), "Access group updated", () => { setSelectedInvestors(new Set()); setBulkInvGroup(""); });
                                        }}>Apply</Button>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Select value={bulkInvStatus} onValueChange={v => setBulkInvStatus(v ?? '')}>
                                            <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue placeholder="Set Status" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="active">Active</SelectItem>
                                                <SelectItem value="inactive">Inactive</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <Button size="sm" variant="outline" className="h-8 text-xs" disabled={!bulkInvStatus || isPending} onClick={() => {
                                            const ids = [...selectedInvestors];
                                            void runBulkActions(ids, id => ({ action: "update-investor", investorId: id, status: bulkInvStatus }), "Status updated", () => { setSelectedInvestors(new Set()); setBulkInvStatus(""); });
                                        }}>Apply</Button>
                                    </div>
                                    <Button size="sm" variant="outline" className="h-8 text-xs text-red-600 border-red-200 hover:bg-red-50" disabled={isPending} onClick={() => {
                                        if (window.confirm(`Archive ${selectedInvestors.size} investor(s)?`)) {
                                            void runBulkActions([...selectedInvestors], id => ({ action: "archive-investor", investorId: id }), "Investors archived", () => setSelectedInvestors(new Set()));
                                        }
                                    }}>Archive Selected</Button>
                                    <Button size="sm" variant="ghost" className="h-8 text-xs ml-auto" onClick={() => setSelectedInvestors(new Set())}>Clear</Button>
                                </div>
                            )}
                            <CardContent className="p-0">
                                <ScrollArea className="max-h-[520px]">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-slate-50/60 hover:bg-slate-50/60">
                                                <TableHead className="w-10 pl-4">
                                                    <Checkbox
                                                        checked={filteredInvestors.length > 0 && filteredInvestors.every(i => selectedInvestors.has(i.id))}
                                                        onCheckedChange={() => toggleAll(filteredInvestors.map(i => i.id), selectedInvestors, setSelectedInvestors)}
                                                    />
                                                </TableHead>
                                                <TableHead>Investor</TableHead>
                                                <TableHead>Type</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Admin</TableHead>
                                                <TableHead>Access Group</TableHead>
                                                <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredInvestors.length ? filteredInvestors.map(inv => (
                                                <TableRow key={inv.id} className={`group ${selectedInvestors.has(inv.id) ? "bg-blue-50/50" : ""}`}>
                                                    <TableCell className="pl-4">
                                                        <Checkbox checked={selectedInvestors.has(inv.id)} onCheckedChange={() => toggleSelection(selectedInvestors, setSelectedInvestors, inv.id)} />
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="space-y-0.5">
                                                            <p className="font-medium text-slate-900">{inv.name}</p>
                                                            <p className="text-xs text-muted-foreground">{inv.email}</p>
                                                            <p className="text-xs text-muted-foreground font-mono">{inv.slug}</p>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell><Badge variant="outline" className="font-mono text-xs">{inv.investorType}</Badge></TableCell>
                                                    <TableCell>
                                                        <Badge variant={inv.isActive ? "default" : "secondary"} className={inv.isActive ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : "bg-slate-100 text-slate-500 hover:bg-slate-100"}>
                                                            {inv.status}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        {inv.isAdmin ? <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Admin</Badge> : <span className="text-muted-foreground text-sm">—</span>}
                                                    </TableCell>
                                                    <TableCell className="text-sm">{inv.accessGroupName || <span className="text-muted-foreground">—</span>}</TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setInvestorForm({ id: inv.id, name: inv.name, slug: inv.slug, email: inv.email, password: "", investorType: inv.investorType.toLowerCase(), status: inv.isActive ? "active" : "inactive", isAdmin: inv.isAdmin, accessGroupId: inv.accessGroupId })}>
                                                                Edit
                                                            </Button>
                                                            <Button variant="ghost" size="sm" className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => {
                                                                if (window.confirm(`Archive investor "${inv.name}"?`)) {
                                                                    void runAction({ action: "archive-investor", investorId: inv.id }, "Investor archived.", () => { if (investorForm.id === inv.id) setInvestorForm(emptyInvestor); });
                                                                }
                                                            }}>
                                                                Archive
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )) : (
                                                <TableRow>
                                                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No investors match the current filter.</TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* ═══════════════ DOCUMENTS TAB ═══════════════════════ */}
                    <TabsContent value="documents" className="space-y-4">
                        <Card className="border-slate-200/80 shadow-sm">
                            <CardHeader>
                                <CardTitle className="text-lg">{documentForm.id ? "Edit Document" : "Create Document"}</CardTitle>
                                <CardDescription>
                                    {documentForm.id
                                        ? "Update the selected document's metadata and visibility."
                                        : "Import a new dashboard report from a public file URL."}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form
                                    onSubmit={e => {
                                        e.preventDefault();
                                        void runAction(
                                            {
                                                action: documentForm.id ? "update-document" : "create-document",
                                                documentId: documentForm.id,
                                                title: documentForm.title, slug: documentForm.slug,
                                                fileUrl: documentForm.fileUrl, date: documentForm.date,
                                                categoryId: documentForm.categoryId, investorId: documentForm.investorId,
                                                accessGroupId: documentForm.accessGroupId, showToAllMembers: documentForm.showToAllMembers,
                                            },
                                            documentForm.id ? "Document updated." : "Document created.",
                                            () => setDocumentForm(emptyDocument),
                                        );
                                    }}
                                    className="space-y-5"
                                >
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                        <FieldGroup label="Document Title">
                                            <Input value={documentForm.title} onChange={e => setDocumentForm(c => ({ ...c, title: e.target.value, slug: c.slug || slugifyValue(e.target.value) }))} placeholder="Q4 FY2025 Investor Letter" />
                                        </FieldGroup>
                                        <FieldGroup label="Slug">
                                            <div className="flex gap-2">
                                                <Input value={documentForm.slug} onChange={e => setDocumentForm(c => ({ ...c, slug: e.target.value }))} placeholder="q4-fy2025-investor-letter" className="flex-1" />
                                                <Button type="button" variant="outline" size="sm" className="shrink-0 h-9 px-3 text-xs" onClick={() => setDocumentForm(c => ({ ...c, slug: slugifyValue(c.title) }))}>Auto</Button>
                                            </div>
                                        </FieldGroup>
                                        <FieldGroup label="Document Date">
                                            <Input type="date" value={documentForm.date} onChange={e => setDocumentForm(c => ({ ...c, date: e.target.value }))} />
                                        </FieldGroup>
                                        <FieldGroup label={documentForm.id ? "Public File URL" : "Public File URL (required)"}>
                                            <Input type="url" value={documentForm.fileUrl} onChange={e => setDocumentForm(c => ({ ...c, fileUrl: e.target.value }))} placeholder="https://example.com/report.pdf" />
                                        </FieldGroup>
                                        <FieldGroup label="Category">
                                            <Select value={documentForm.categoryId || "__none__"} onValueChange={v => setDocumentForm(c => ({ ...c, categoryId: v === "__none__" ? "" : (v ?? '') }))}>
                                                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="__none__">No category</SelectItem>
                                                    {data.categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </FieldGroup>
                                        <FieldGroup label="Direct Investor">
                                            <Select value={documentForm.investorId || "__none__"} onValueChange={v => setDocumentForm(c => ({ ...c, investorId: v === "__none__" ? "" : (v ?? '') }))}>
                                                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="__none__">No direct investor</SelectItem>
                                                    {data.investors.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </FieldGroup>
                                        <FieldGroup label="Access Group">
                                            <Select value={documentForm.accessGroupId || "__none__"} onValueChange={v => setDocumentForm(c => ({ ...c, accessGroupId: v === "__none__" ? "" : (v ?? '') }))}>
                                                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="__none__">No group</SelectItem>
                                                    {data.accessGroups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </FieldGroup>
                                        <FieldGroup label="Visibility">
                                            <div className="flex items-center gap-2 h-9 px-3 border rounded-md bg-white">
                                                <Checkbox
                                                    id="docVisibility"
                                                    checked={documentForm.showToAllMembers}
                                                    onCheckedChange={v => setDocumentForm(c => ({ ...c, showToAllMembers: Boolean(v) }))}
                                                />
                                                <Label htmlFor="docVisibility" className="text-sm font-normal cursor-pointer">Show to all members</Label>
                                            </div>
                                        </FieldGroup>
                                    </div>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        Files are imported into the Webflow CMS from a public URL. For updates, leave the existing URL or replace it.
                                    </p>
                                    <div className="flex gap-3">
                                        <Button type="submit" disabled={isPending || !documentForm.title.trim() || (!documentForm.id && !documentForm.fileUrl.trim())} className="bg-slate-900 hover:bg-slate-800">
                                            {documentForm.id ? "Update Document" : "Create Document"}
                                        </Button>
                                        {documentForm.id && (
                                            <Button type="button" variant="ghost" onClick={() => setDocumentForm(emptyDocument)}>Cancel</Button>
                                        )}
                                    </div>
                                </form>
                            </CardContent>
                        </Card>

                        <Card className="border-slate-200/80 shadow-sm">
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between gap-4">
                                    <CardTitle className="text-lg">All Documents</CardTitle>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Badge variant="secondary" className="font-mono">{filteredDocuments.length}</Badge>
                                        live documents
                                    </div>
                                </div>
                                <div className="relative mt-2">
                                    <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                    <Input value={documentQuery} onChange={e => setDocumentQuery(e.target.value)} placeholder="Search by title, category, investor, group, or slug…" className="pl-9 h-9" />
                                </div>
                            </CardHeader>
                            {/* ── Bulk actions bar ── */}
                            {selectedDocuments.size > 0 && (
                                <div className="mx-4 mb-3 p-3 rounded-lg bg-blue-50 border border-blue-200 flex flex-wrap items-center gap-3 animate-in slide-in-from-top-1 duration-200">
                                    <Badge className="bg-blue-600 text-white hover:bg-blue-600">{selectedDocuments.size} selected</Badge>
                                    <Separator orientation="vertical" className="h-5" />
                                    <div className="flex items-center gap-2">
                                        <Select value={bulkDocGroup} onValueChange={v => setBulkDocGroup(v ?? '')}>
                                            <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue placeholder="Assign Group" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="__none__">No group</SelectItem>
                                                {data.accessGroups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        <Button size="sm" variant="outline" className="h-8 text-xs" disabled={!bulkDocGroup || isPending} onClick={() => {
                                            void runBulkActions([...selectedDocuments], id => ({ action: "update-document", documentId: id, accessGroupId: bulkDocGroup === "__none__" ? "" : bulkDocGroup }), "Access group updated", () => { setSelectedDocuments(new Set()); setBulkDocGroup(""); });
                                        }}>Apply</Button>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Select value={bulkDocCategory} onValueChange={v => setBulkDocCategory(v ?? '')}>
                                            <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue placeholder="Assign Category" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="__none__">No category</SelectItem>
                                                {data.categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        <Button size="sm" variant="outline" className="h-8 text-xs" disabled={!bulkDocCategory || isPending} onClick={() => {
                                            void runBulkActions([...selectedDocuments], id => ({ action: "update-document", documentId: id, categoryId: bulkDocCategory === "__none__" ? "" : bulkDocCategory }), "Category updated", () => { setSelectedDocuments(new Set()); setBulkDocCategory(""); });
                                        }}>Apply</Button>
                                    </div>
                                    <Button size="sm" variant="outline" className="h-8 text-xs" disabled={isPending} onClick={() => {
                                        void runBulkActions([...selectedDocuments], id => ({ action: "update-document", documentId: id, showToAllMembers: true }), "Visibility set to all members", () => setSelectedDocuments(new Set()));
                                    }}>Show to All</Button>
                                    <Button size="sm" variant="outline" className="h-8 text-xs text-red-600 border-red-200 hover:bg-red-50" disabled={isPending} onClick={() => {
                                        if (window.confirm(`Archive ${selectedDocuments.size} document(s)?`)) {
                                            void runBulkActions([...selectedDocuments], id => ({ action: "archive-document", documentId: id }), "Documents archived", () => setSelectedDocuments(new Set()));
                                        }
                                    }}>Archive Selected</Button>
                                    <Button size="sm" variant="ghost" className="h-8 text-xs ml-auto" onClick={() => setSelectedDocuments(new Set())}>Clear</Button>
                                </div>
                            )}
                            <CardContent className="p-0">
                                <ScrollArea className="max-h-[520px]">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-slate-50/60 hover:bg-slate-50/60">
                                                <TableHead className="w-10 pl-4">
                                                    <Checkbox
                                                        checked={filteredDocuments.length > 0 && filteredDocuments.every(d => selectedDocuments.has(d.id))}
                                                        onCheckedChange={() => toggleAll(filteredDocuments.map(d => d.id), selectedDocuments, setSelectedDocuments)}
                                                    />
                                                </TableHead>
                                                <TableHead>Document</TableHead>
                                                <TableHead>Visibility</TableHead>
                                                <TableHead>Category</TableHead>
                                                <TableHead>Investor</TableHead>
                                                <TableHead>Access Group</TableHead>
                                                <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredDocuments.length ? filteredDocuments.map(doc => (
                                                <TableRow key={doc.id} className={`group ${selectedDocuments.has(doc.id) ? "bg-blue-50/50" : ""}`}>
                                                    <TableCell className="pl-4">
                                                        <Checkbox checked={selectedDocuments.has(doc.id)} onCheckedChange={() => toggleSelection(selectedDocuments, setSelectedDocuments, doc.id)} />
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="space-y-0.5">
                                                            <p className="font-medium text-slate-900">{doc.title}</p>
                                                            <p className="text-xs text-muted-foreground font-mono">{doc.slug}</p>
                                                            <p className="text-xs text-muted-foreground">{doc.date || "No date"}</p>
                                                            {doc.fileUrl && (
                                                                <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 no-underline hover:no-underline">
                                                                    Open file <IconExternalLink />
                                                                </a>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="space-y-1">
                                                            <Badge variant={doc.showToAllMembers ? "default" : "secondary"} className={doc.showToAllMembers ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : "bg-slate-100 text-slate-500 hover:bg-slate-100"}>
                                                                {doc.showToAllMembers ? "All members" : "Restricted"}
                                                            </Badge>
                                                            {doc.fileSizeLabel && <p className="text-xs text-muted-foreground">{doc.fileSizeLabel}</p>}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-sm">{doc.categoryName}</TableCell>
                                                    <TableCell className="text-sm">{doc.investorName || <span className="text-muted-foreground">—</span>}</TableCell>
                                                    <TableCell className="text-sm">{doc.accessGroupName || <span className="text-muted-foreground">—</span>}</TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setDocumentForm({ id: doc.id, title: doc.title, slug: doc.slug, fileUrl: doc.fileUrl, date: doc.date, categoryId: doc.categoryId, investorId: doc.investorId, accessGroupId: doc.accessGroupId, showToAllMembers: doc.showToAllMembers })}>
                                                                Edit
                                                            </Button>
                                                            <Button variant="ghost" size="sm" className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => {
                                                                if (window.confirm(`Archive document "${doc.title}"?`)) {
                                                                    void runAction({ action: "archive-document", documentId: doc.id }, "Document archived.", () => { if (documentForm.id === doc.id) setDocumentForm(emptyDocument); });
                                                                }
                                                            }}>
                                                                Archive
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )) : (
                                                <TableRow>
                                                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No documents match the current filter.</TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* ═══════════════ TAXONOMY TAB ════════════════════════ */}
                    <TabsContent value="taxonomy" className="space-y-4">
                        <div className="relative">
                            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground z-10" />
                            <Input value={taxonomyQuery} onChange={e => setTaxonomyQuery(e.target.value)} placeholder="Filter groups and categories…" className="pl-9 h-9" />
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {/* ─── Access Groups ─────────────────────────── */}
                            <Card className="border-slate-200/80 shadow-sm">
                                <CardHeader>
                                    <CardTitle className="text-lg">Access Groups</CardTitle>
                                    <CardDescription>Create shared visibility clusters and rename or archive them.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <form
                                        onSubmit={e => {
                                            e.preventDefault();
                                            void runAction(
                                                { action: groupForm.id ? "update-access-group" : "create-access-group", accessGroupId: groupForm.id, name: groupForm.name, slug: groupForm.slug },
                                                groupForm.id ? "Access group updated." : "Access group created.",
                                                () => setGroupForm(emptyNamed),
                                            );
                                        }}
                                        className="space-y-3"
                                    >
                                        <div className="grid grid-cols-2 gap-3">
                                            <FieldGroup label="Group Name">
                                                <Input value={groupForm.name} onChange={e => setGroupForm(c => ({ ...c, name: e.target.value, slug: c.slug || slugifyValue(e.target.value) }))} placeholder="Founder Circle" />
                                            </FieldGroup>
                                            <FieldGroup label="Slug">
                                                <div className="flex gap-2">
                                                    <Input value={groupForm.slug} onChange={e => setGroupForm(c => ({ ...c, slug: e.target.value }))} placeholder="founder-circle" className="flex-1" />
                                                    <Button type="button" variant="outline" size="sm" className="shrink-0 h-9 px-3 text-xs" onClick={() => setGroupForm(c => ({ ...c, slug: slugifyValue(c.name) }))}>Auto</Button>
                                                </div>
                                            </FieldGroup>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button type="submit" size="sm" disabled={isPending || !groupForm.name.trim()} className="bg-slate-900 hover:bg-slate-800">
                                                {groupForm.id ? "Update" : "Create"}
                                            </Button>
                                            {groupForm.id && <Button type="button" variant="ghost" size="sm" onClick={() => setGroupForm(emptyNamed)}>Cancel</Button>}
                                        </div>
                                    </form>
                                    <Separator />
                                    <ScrollArea className="max-h-[320px]">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-slate-50/60 hover:bg-slate-50/60">
                                                    <TableHead>Group</TableHead>
                                                    <TableHead className="text-center">Members</TableHead>
                                                    <TableHead className="text-center">Docs</TableHead>
                                                    <TableHead className="text-right">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {filteredGroups.length ? filteredGroups.map(g => (
                                                    <TableRow key={g.id} className="group">
                                                        <TableCell>
                                                            <p className="font-medium text-slate-900">{g.name}</p>
                                                            <p className="text-xs text-muted-foreground font-mono">{g.slug}</p>
                                                        </TableCell>
                                                        <TableCell className="text-center"><Badge variant="secondary" className="font-mono">{g.membersCount}</Badge></TableCell>
                                                        <TableCell className="text-center"><Badge variant="secondary" className="font-mono">{g.documentsCount}</Badge></TableCell>
                                                        <TableCell className="text-right">
                                                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setGroupForm({ id: g.id, name: g.name, slug: g.slug })}>Edit</Button>
                                                                <Button variant="ghost" size="sm" className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => {
                                                                    if (window.confirm(`Archive "${g.name}"?`)) {
                                                                        void runAction({ action: "archive-access-group", accessGroupId: g.id }, "Access group archived.", () => { if (groupForm.id === g.id) setGroupForm(emptyNamed); });
                                                                    }
                                                                }}>Archive</Button>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                )) : (
                                                    <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">No groups match.</TableCell></TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </ScrollArea>
                                </CardContent>
                            </Card>

                            {/* ─── Categories ─────────────────────────────── */}
                            <Card className="border-slate-200/80 shadow-sm">
                                <CardHeader>
                                    <CardTitle className="text-lg">Categories</CardTitle>
                                    <CardDescription>Keep dashboard filter pills aligned with CMS categories.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <form
                                        onSubmit={e => {
                                            e.preventDefault();
                                            void runAction(
                                                { action: categoryForm.id ? "update-category" : "create-category", categoryId: categoryForm.id, name: categoryForm.name, slug: categoryForm.slug },
                                                categoryForm.id ? "Category updated." : "Category created.",
                                                () => setCategoryForm(emptyNamed),
                                            );
                                        }}
                                        className="space-y-3"
                                    >
                                        <div className="grid grid-cols-2 gap-3">
                                            <FieldGroup label="Category Name">
                                                <Input value={categoryForm.name} onChange={e => setCategoryForm(c => ({ ...c, name: e.target.value, slug: c.slug || slugifyValue(e.target.value) }))} placeholder="Quarterly Reports" />
                                            </FieldGroup>
                                            <FieldGroup label="Slug">
                                                <div className="flex gap-2">
                                                    <Input value={categoryForm.slug} onChange={e => setCategoryForm(c => ({ ...c, slug: e.target.value }))} placeholder="quarterly-reports" className="flex-1" />
                                                    <Button type="button" variant="outline" size="sm" className="shrink-0 h-9 px-3 text-xs" onClick={() => setCategoryForm(c => ({ ...c, slug: slugifyValue(c.name) }))}>Auto</Button>
                                                </div>
                                            </FieldGroup>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button type="submit" size="sm" disabled={isPending || !categoryForm.name.trim()} className="bg-slate-900 hover:bg-slate-800">
                                                {categoryForm.id ? "Update" : "Create"}
                                            </Button>
                                            {categoryForm.id && <Button type="button" variant="ghost" size="sm" onClick={() => setCategoryForm(emptyNamed)}>Cancel</Button>}
                                        </div>
                                    </form>
                                    <Separator />
                                    <ScrollArea className="max-h-[320px]">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-slate-50/60 hover:bg-slate-50/60">
                                                    <TableHead>Category</TableHead>
                                                    <TableHead className="text-center">Docs</TableHead>
                                                    <TableHead className="text-right">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {filteredCategories.length ? filteredCategories.map(c => (
                                                    <TableRow key={c.id} className="group">
                                                        <TableCell>
                                                            <p className="font-medium text-slate-900">{c.name}</p>
                                                            <p className="text-xs text-muted-foreground font-mono">{c.slug}</p>
                                                        </TableCell>
                                                        <TableCell className="text-center"><Badge variant="secondary" className="font-mono">{c.documentsCount}</Badge></TableCell>
                                                        <TableCell className="text-right">
                                                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setCategoryForm({ id: c.id, name: c.name, slug: c.slug })}>Edit</Button>
                                                                <Button variant="ghost" size="sm" className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => {
                                                                    if (window.confirm(`Archive "${c.name}"?`)) {
                                                                        void runAction({ action: "archive-category", categoryId: c.id }, "Category archived.", () => { if (categoryForm.id === c.id) setCategoryForm(emptyNamed); });
                                                                    }
                                                                }}>Archive</Button>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                )) : (
                                                    <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">No categories match.</TableCell></TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </ScrollArea>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    {/* ═══════════════ REFERENCE TAB ═══════════════════════ */}
                    <TabsContent value="info" className="space-y-4">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <Card className="border-slate-200/80 shadow-sm">
                                <CardHeader>
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 rounded-lg bg-blue-50">
                                            <IconShield className="text-blue-600" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-lg">Access Model</CardTitle>
                                            <CardDescription>The visibility order applied by the member dashboard.</CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {[
                                        { level: "Global", desc: "Show To All Members is enabled on the document", num: "1" },
                                        { level: "Direct", desc: "The document is linked to a single investor", num: "2" },
                                        { level: "Shared", desc: "Investor and document share the same Access Group", num: "3" },
                                    ].map(r => (
                                        <div key={r.level} className="flex items-start gap-3 p-3 rounded-lg border bg-slate-50/60">
                                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold shrink-0 mt-0.5">{r.num}</span>
                                            <div>
                                                <p className="font-semibold text-sm text-slate-900">{r.level}</p>
                                                <p className="text-xs text-muted-foreground leading-relaxed">{r.desc}</p>
                                            </div>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>

                            <Card className="border-slate-200/80 shadow-sm">
                                <CardHeader>
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 rounded-lg bg-amber-50">
                                            <IconInfo className="text-amber-600" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-lg">Operational Notes</CardTitle>
                                            <CardDescription>Guardrails to keep edits predictable in production.</CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {[
                                        "Archived items disappear from this admin view — only live CMS entries are loaded.",
                                        "Password changes are published live, so investors can sign in with the new password immediately.",
                                        "Document creation expects a public file URL so Webflow can import the file into the Report File field.",
                                    ].map((note, i) => (
                                        <div key={i} className="p-3 rounded-lg border bg-amber-50/40 text-sm text-slate-700 leading-relaxed">
                                            {note}
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */

function StatCard({ icon, label, value, helper, accent }: { icon: React.ReactNode; label: string; value: number; helper: string; accent: string }) {
    const bgMap: Record<string, string> = {
        blue: "from-blue-50 to-blue-100/40",
        violet: "from-violet-50 to-violet-100/40",
        amber: "from-amber-50 to-amber-100/40",
        emerald: "from-emerald-50 to-emerald-100/40",
    };
    return (
        <Card className={`border-slate-200/60 overflow-hidden bg-gradient-to-br ${bgMap[accent] || bgMap.blue} shadow-sm hover:shadow-md transition-shadow duration-200`}>
            <CardContent className="py-5 px-5">
                <div className="flex items-start justify-between mb-3">
                    <div className="p-2 rounded-xl bg-white/80 shadow-sm">{icon}</div>
                </div>
                <p className="text-3xl font-bold tracking-tight text-slate-900">{value}</p>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mt-1">{label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{helper}</p>
            </CardContent>
        </Card>
    );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-600">{label}</Label>
            {children}
        </div>
    );
}
