import { notFound } from "next/navigation";
import { DesignCard } from "@/components/DesignCard";
import { currentUser } from "@/lib/auth";
import { getUserProfile, listDesigns } from "@/lib/designs";

export const dynamic = "force-dynamic";

export default async function Profile({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const user = await getUserProfile(username);
  if (!user) notFound();
  const viewer = await currentUser();
  const own = viewer?.id === user.id;
  const designs = await listDesigns(
    viewer,
    own ? { scope: "mine", pageSize: 100 } : { owner: user.username, pageSize: 100 },
  );
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt="" width={64} height={64} className="rounded-full" />
        ) : (
          <div className="h-16 w-16 rounded-full" style={{ background: "var(--line)" }} />
        )}
        <div>
          <h1 className="text-2xl font-semibold">{user.displayName ?? user.username}</h1>
          <div className="muted text-sm">@{user.username}</div>
          {user.bio ? <p className="mt-1 text-sm">{user.bio}</p> : null}
        </div>
      </div>
      <section>
        <h2 className="text-lg font-medium">
          {own ? "Your designs" : "Public designs"}{" "}
          <span className="muted text-sm">({designs.total})</span>
        </h2>
        {designs.items.length === 0 ? (
          <p className="muted mt-2 text-sm">
            {own
              ? "Nothing yet. Create a design or clone one from Browse."
              : "No public designs yet."}
          </p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {designs.items.map((d) => (
              <DesignCard key={d.id} d={d} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
