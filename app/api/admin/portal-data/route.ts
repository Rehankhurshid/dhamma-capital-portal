import { NextRequest, NextResponse } from "next/server";
import {
  createAccessGroup,
  loadAdminOverview,
  updateDocumentAccess,
  updateInvestorAccess,
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
      await createAccessGroup(String(body.name || ""), cfg);
      return NextResponse.json({ ok: true });
    }

    if (action === "update-investor") {
      const investorId = String(body.investorId || "");
      await updateInvestorAccess(
        investorId,
        {
          "is-admin": Boolean(body.isAdmin),
          "access-group": String(body.accessGroupId || ""),
        },
        cfg
      );
      return NextResponse.json({ ok: true });
    }

    if (action === "update-document") {
      const documentId = String(body.documentId || "");
      await updateDocumentAccess(
        documentId,
        {
          "type-of-reports": String(body.categoryId || ""),
          investor: String(body.investorId || ""),
          "access-group": String(body.accessGroupId || ""),
          "show-to-all-members": Boolean(body.showToAllMembers),
        },
        cfg
      );
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unsupported admin action" }, { status: 400 });
  } catch (routeError) {
    console.error("Admin portal-data error:", routeError);
    return NextResponse.json({ error: "Unable to update portal data" }, { status: 500 });
  }
}
