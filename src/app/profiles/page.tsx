import { listProfiles } from "@/lib/repos/profiles";
import { EmptyState } from "@/components/EmptyState";
import { ProfileCard } from "@/components/profiles/ProfileCard";
import { NewProfileButton } from "@/components/profiles/NewProfileButton";

export const dynamic = "force-dynamic";

export default function ProfilesPage() {
  const profiles = listProfiles({ includeTemplates: true });

  return (
    <section className="max-w-[1600px]">
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-mono text-xs tracking-widest text-hive-amber">
            [ PROFILES ]
          </h1>
          <p className="mt-1 text-xs text-hive-muted">
            reusable agent configurations — system prompt, model, tools, perms
          </p>
        </div>
        <NewProfileButton />
      </header>

      {profiles.length === 0 ? (
        <EmptyState
          title="No agent profiles yet"
          description="Create a profile to define a reusable agent (system prompt, model, tools, permissions) that tasks can run with."
          cta={{ label: "+ New profile", href: "#" }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {profiles.map((p) => (
            <ProfileCard key={p.id} profile={p} />
          ))}
        </div>
      )}
    </section>
  );
}
