import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminDashboardClient } from "@/app/admin/AdminDashboardClient";
import { loadAdminOverview } from "@/app/lib/admin";
import { getConfig, getEnvFromProcess, getSessionFromCookieStore } from "@/app/lib/api";

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

  const data = await loadAdminOverview(cfg);

  return <AdminDashboardClient initialData={data} />;
}
