import { listProfiles } from "@/lib/repos/profiles";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProfileCard } from "@/components/profiles/ProfileCard";
import { NewProfileButton } from "@/components/profiles/NewProfileButton";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ new?: string | string[] }>;
};

function SectionHeading({
  id,
  title,
  count,
  hint,
}: {
  id: string;
  title: string;
  count: number;
  hint?: string;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h2 id={id} className="text-lg font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      <span className="font-mono text-[11px] text-faint">{count}</span>
      {hint ? <p className="text-[13px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export default async function ProfilesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const autoOpenCreate = sp.new === "1";

  const profiles = listProfiles({ includeTemplates: true });
  const own = profiles.filter((p) => !p.isTemplate);
  const templates = profiles.filter((p) => p.isTemplate);

  return (
    <section className="mx-auto max-w-7xl">
      <PageHeader
        overline="Profiles"
        title="Agent profiles"
        description="Reusable agent configurations — system prompt, model, tools and permissions that any task can run with."
        actions={<NewProfileButton autoOpenCreate={autoOpenCreate} />}
      />

      {profiles.length === 0 ? (
        <EmptyState
          illustration="spark"
          title="No agent profiles yet"
          description="Create a profile to define a reusable agent — its system prompt, model, tools and permissions — that tasks can run with."
          cta={{ label: "New profile", modal: "newProfile" }}
        />
      ) : (
        <div className="flex flex-col gap-10">
          {own.length > 0 ? (
            <section aria-labelledby="own-profiles-heading">
              <SectionHeading
                id="own-profiles-heading"
                title="Your profiles"
                count={own.length}
              />
              <div className="stagger-children grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {own.map((p) => (
                  <ProfileCard key={p.id} profile={p} />
                ))}
              </div>
            </section>
          ) : (
            <EmptyState
              illustration="spark"
              title="No profiles of your own yet"
              description="Start from scratch, or open a template below and duplicate it to make it yours."
              cta={{ label: "New profile", modal: "newProfile" }}
            />
          )}

          {templates.length > 0 ? (
            <section aria-labelledby="templates-heading">
              <SectionHeading
                id="templates-heading"
                title="Templates"
                count={templates.length}
                hint="Ready-made starting points — open one and duplicate it."
              />
              <div className="stagger-children grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {templates.map((p) => (
                  <ProfileCard key={p.id} profile={p} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </section>
  );
}
