import { getAdminUser } from "@/lib/auth/admin";
import { isAdminDbConfigured, createAdminClient } from "@/lib/supabase/admin";
import { AdminConfigNotice } from "@/components/platform/admin-config-notice";

export const metadata = { title: "Projects" };
export const dynamic = "force-dynamic";

interface ProjectRow {
  id: string;
  name: string;
  kind: string;
  status: string;
  user_id: string;
  updated_at: string;
}

export default async function AdminProjectsPage() {
  if (!(await getAdminUser())) return null;
  if (!isAdminDbConfigured()) return <AdminConfigNotice />;

  const db = createAdminClient();
  const { data: projects } = await db
    .from("projects")
    .select("id, name, kind, status, user_id, updated_at")
    .order("updated_at", { ascending: false })
    .limit(200);

  const rows = (projects as ProjectRow[]) ?? [];
  const ownerIds = Array.from(new Set(rows.map((r) => r.user_id)));
  const { data: profiles } = await db
    .from("profiles")
    .select("id, email")
    .in("id", ownerIds.length ? ownerIds : ["00000000-0000-0000-0000-000000000000"]);
  const emailMap = new Map<string, string>(
    ((profiles as { id: string; email: string | null }[]) ?? []).map((p) => [
      p.id,
      p.email ?? "—",
    ]),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-[1.85rem] leading-tight text-dusk">
          Projects
        </h1>
        <p className="mt-1.5 text-[13.5px] text-dusk-muted">
          {rows.length} most recently active projects.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-carbon-line">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-carbon-line bg-carbon-raised text-left font-mono text-[10.5px] uppercase tracking-widest text-dusk-faint">
              <th className="px-4 py-3">Project</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Kind</th>
              <th className="px-4 py-3">Status</th>
              <th className="hidden px-4 py-3 sm:table-cell">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-carbon-line/60">
            {rows.map((p) => (
              <tr key={p.id} className="bg-carbon-raised hover:bg-carbon-high/40">
                <td className="px-4 py-3 font-medium text-dusk">{p.name}</td>
                <td className="px-4 py-3 text-dusk-muted">
                  {emailMap.get(p.user_id) ?? "—"}
                </td>
                <td className="px-4 py-3 text-dusk-faint">{p.kind}</td>
                <td className="px-4 py-3 text-dusk-faint">{p.status}</td>
                <td className="hidden px-4 py-3 text-dusk-faint sm:table-cell">
                  {new Date(p.updated_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
