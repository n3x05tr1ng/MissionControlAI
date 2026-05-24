import Link from "next/link";

import { ProfileEditor } from "@/components/profiles/ProfileEditor";
import { UsageStats } from "@/components/stats/UsageStats";
import { getMcpCatalog } from "@/lib/mcp/catalog";
import { getProfile } from "@/lib/repos/profiles";
import { getModels } from "@/lib/settings";
import { usageByProfile } from "@/lib/stats/queries";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function ProfilePage({ params }: Props) {
  const { id } = await params;
  const profile = getProfile(id);
  if (!profile) {
    return (
      <section className="max-w-[1200px]">
        <header className="mb-6">
          <h1 className="font-mono text-xs tracking-widest text-hive-amber">
            [ PROFILE NOT FOUND ]
          </h1>
        </header>
        <div className="border border-hive-border bg-hive-panel p-6 text-sm text-hive-muted">
          No profile with id <span className="font-mono text-hive-text">{id}</span>.
          <div className="mt-3">
            <Link
              href="/profiles"
              className="font-mono text-[11px] uppercase tracking-widest text-hive-amber hover:underline"
            >
              ← back to profiles
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const models = getModels();
  const mcpCatalog = getMcpCatalog();
  const stats = usageByProfile(id);

  return (
    <section className="max-w-[1200px]">
      <header className="mb-4">
        <Link
          href="/profiles"
          className="font-mono text-[10px] uppercase tracking-widest text-hive-muted hover:text-hive-amber"
        >
          ← profiles
        </Link>
      </header>
      <div className="mb-6">
        <UsageStats stats={stats} />
      </div>
      <ProfileEditor profile={profile} models={models} mcpCatalog={mcpCatalog} />
    </section>
  );
}
