import Link from "next/link";

import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProfileEditor } from "@/components/profiles/ProfileEditor";
import { UsageStats } from "@/components/stats/UsageStats";
import { getMcpCatalog } from "@/lib/mcp/catalog";
import { getProfile } from "@/lib/repos/profiles";
import { getModels } from "@/lib/settings";
import { usageByProfile } from "@/lib/stats/queries";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

function BackLink() {
  return (
    <nav className="animate-enter mb-4">
      <Link
        href="/profiles"
        className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        All profiles
      </Link>
    </nav>
  );
}

export default async function ProfilePage({ params }: Props) {
  const { id } = await params;
  const profile = getProfile(id);

  if (!profile) {
    return (
      <section className="mx-auto max-w-7xl">
        <BackLink />
        <PageHeader overline="Profiles" title="Profile not found" />
        <EmptyState
          illustration="folder"
          title="This profile doesn't exist"
          description={`We couldn't find a profile with id "${id}". It may have been deleted or the link is outdated.`}
          cta={{ label: "Back to profiles", href: "/profiles" }}
        />
      </section>
    );
  }

  const models = getModels();
  const mcpCatalog = getMcpCatalog();
  const stats = usageByProfile(id);

  return (
    <section className="mx-auto max-w-7xl">
      <BackLink />
      <ProfileEditor profile={profile} models={models} mcpCatalog={mcpCatalog} />
      <div className="animate-enter mt-8">
        <UsageStats stats={stats} />
      </div>
    </section>
  );
}
