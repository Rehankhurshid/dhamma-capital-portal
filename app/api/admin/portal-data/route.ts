import { NextRequest, NextResponse } from "next/server";
import {
    archiveAccessGroup,
    archiveCategory,
    archiveDocument,
    archiveInvestor,
    createAccessGroup,
    createCategory,
    createDocument,
    createInvestor,
    loadAdminOverview,
    updateAccessGroup,
    updateCategory,
    updateDocument,
    updateInvestor,
} from "@/app/lib/admin";
import { getConfig, getEnvFromProcess, getSession } from "@/app/lib/api";

async function requireAdmin(req: NextRequest) {
    const cfg = getConfig(getEnvFromProcess());
    const session = await getSession(req, cfg);
    if (!session || !session.is_admin) {
        return { cfg, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    }
    return { cfg, error: null };
}

export async function GET(req: NextRequest) {
    const { cfg, error } = await requireAdmin(req);
    if (error) return error;

    const data = await loadAdminOverview(cfg);
    return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
    const { cfg, error } = await requireAdmin(req);
    if (error) return error;

    try {
        const body = (await req.json()) as Record<string, unknown>;
        const action = String(body.action || "");

        if (action === "create-access-group") {
            await createAccessGroup(String(body.name || ""), String(body.slug || ""), cfg);
            return NextResponse.json({ ok: true });
        }

        if (action === "update-access-group") {
            await updateAccessGroup(
                String(body.accessGroupId || ""),
                String(body.name || ""),
                String(body.slug || ""),
                cfg
            );
            return NextResponse.json({ ok: true });
        }

        if (action === "archive-access-group") {
            await archiveAccessGroup(String(body.accessGroupId || ""), cfg);
            return NextResponse.json({ ok: true });
        }

        if (action === "create-category") {
            await createCategory(String(body.name || ""), String(body.slug || ""), cfg);
            return NextResponse.json({ ok: true });
        }

        if (action === "update-category") {
            await updateCategory(
                String(body.categoryId || ""),
                String(body.name || ""),
                String(body.slug || ""),
                cfg
            );
            return NextResponse.json({ ok: true });
        }

        if (action === "archive-category") {
            await archiveCategory(String(body.categoryId || ""), cfg);
            return NextResponse.json({ ok: true });
        }

        if (action === "create-investor") {
            await createInvestor(
                {
                    name: String(body.name || ""),
                    slug: String(body.slug || ""),
                    email: String(body.email || ""),
                    password: String(body.password || ""),
                    investorType: String(body.investorType || ""),
                    status: String(body.status || ""),
                    isAdmin: Boolean(body.isAdmin),
                    accessGroupId: String(body.accessGroupId || ""),
                },
                cfg
            );
            return NextResponse.json({ ok: true });
        }

        if (action === "update-investor") {
            await updateInvestor(
                String(body.investorId || ""),
                {
                    name: String(body.name || ""),
                    slug: String(body.slug || ""),
                    email: String(body.email || ""),
                    password: String(body.password || ""),
                    investorType: String(body.investorType || ""),
                    status: String(body.status || ""),
                    isAdmin: Boolean(body.isAdmin),
                    accessGroupId: String(body.accessGroupId || ""),
                },
                cfg
            );
            return NextResponse.json({ ok: true });
        }

        if (action === "archive-investor") {
            await archiveInvestor(String(body.investorId || ""), cfg);
            return NextResponse.json({ ok: true });
        }

        if (action === "create-document") {
            await createDocument(
                {
                    title: String(body.title || ""),
                    slug: String(body.slug || ""),
                    fileUrl: String(body.fileUrl || ""),
                    date: String(body.date || ""),
                    categoryId: String(body.categoryId || ""),
                    investorId: String(body.investorId || ""),
                    accessGroupId: String(body.accessGroupId || ""),
                    showToAllMembers: Boolean(body.showToAllMembers),
                },
                cfg
            );
            return NextResponse.json({ ok: true });
        }

        if (action === "update-document") {
            await updateDocument(
                String(body.documentId || ""),
                {
                    title: String(body.title || ""),
                    slug: String(body.slug || ""),
                    fileUrl: String(body.fileUrl || ""),
                    date: String(body.date || ""),
                    categoryId: String(body.categoryId || ""),
                    investorId: String(body.investorId || ""),
                    accessGroupId: String(body.accessGroupId || ""),
                    showToAllMembers: Boolean(body.showToAllMembers),
                },
                cfg
            );
            return NextResponse.json({ ok: true });
        }

        if (action === "archive-document") {
            await archiveDocument(String(body.documentId || ""), cfg);
            return NextResponse.json({ ok: true });
        }

        return NextResponse.json({ error: "Unsupported admin action" }, { status: 400 });
    } catch (routeError) {
        console.error("Admin portal-data error:", routeError);
        return NextResponse.json(
            {
                error: routeError instanceof Error ? routeError.message : "Unable to update portal data",
            },
            { status: 500 }
        );
    }
}
