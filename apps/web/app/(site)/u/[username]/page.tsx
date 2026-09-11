import Link from "next/link";
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
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt="" width={56} height={56} className="avatar" />
        ) : (
          <div className="avatar" style={{ width: 56, height: 56 }} />
        )}
        <div className="flex flex-col gap-0.5">
          <h1 className="display">{user.displayName ?? user.username}</h1>
          <div className="mono meta">@{user.username}</div>
          {user.bio ? <p className="small">{user.bio}</p> : null}
        </div>
      </div>
      <section className="flex flex-col gap-3">
        <span className="label">
          {own ? "Your designs" : "Public designs"} · {designs.total}
        </span>
        {designs.items.length === 0 ? (
          <div className="empty">
            {own ? (
              <>
                Nothing yet.{" "}
                <Link href="/new" className="link">
                  Create a design
                </Link>
                , or clone one from{" "}
                <Link href="/browse" className="link">
                  Browse
                </Link>
                .
              </>
            ) : (
              "No public designs yet."
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {designs.items.map((d) => (
              <DesignCard key={d.id} d={d} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
