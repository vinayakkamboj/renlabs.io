import { getAdminUser } from "@/lib/auth/admin";
import { AdminSecurityClient } from "@/components/platform/admin-security";

export const dynamic = "force-dynamic";
export const metadata = { title: "Security" };

export default async function AdminSecurityPage() {
  const admin = await getAdminUser();
  if (!admin) return null;

  return <AdminSecurityClient />;
}
