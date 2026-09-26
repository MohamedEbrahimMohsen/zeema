import Link from "next/link";
import { notFound } from "next/navigation";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { DesignRow } from "@/components/DesignRow";
import { Pager } from "@/components/Pager";
import { ProfileSocial } from "@/components/ProfileSocial";
import { UserAvatar } from "@/components/UserAvatar";
import { currentUser } from "@/lib/auth";
import { getProfileStats, listDesigns } from "@/lib/designs";
import { intParam } from "@/lib/http-guards";
import { pageTheme } from "@/lib/theme";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

const joined = (at: Date) =>
  at.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

function RowsHead() {
  return (
    <li className="row-cols" aria-hidden>
      <span />
      <span>Design</span>
      <span>Components</span>
      <span>Edges</span>
      <span>Findings</span>
      <span>Clones</span>
      <span />
    </li>
  );
}

export default async function Profile({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const [{ username }, sp] = await Promise.all([params, searchParams]);
  const viewer = await currentUser();
  const profile = await getProfileStats(username, viewer);
  if (!profile) notFound();
  const { user, own, stats, viewerFollows } = profile;
  const page = intParam(sp.page, { fallback: 1, min: 1, max: 10_000 });
  // What everyone sees: the public, released designs, as a reader sees them.
  const [published, drafts, theme] = await Promise.all([
    listDesigns(null, {
      owner: user.username,
      scope: "public",
      released: true,
      sort: "published",
      page,
      pageSize: PAGE_SIZE,
    }),
    own ? listDesigns(viewer, { scope: "mine", drafts: true, pageSize: 50 }) : null,
    pageTheme(),
  ]);
  const base = `/u/${user.username}`;
  return (
    <div className="flex flex-col gap-6">
      <header className="profile-head">
        <UserAvatar user={user} size={72} />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-col gap-0.5">
            <h1 className="display design-title">{user.displayName ?? user.username}</h1>
            <div className="mono meta design-crumb">
              @{user.username} · Joined {joined(user.createdAt)}
            </div>
          </div>
          {user.bio ? <p className="small">{user.bio}</p> : null}
          <ProfileSocial
            username={user.username}
            stats={stats}
            following={viewerFollows}
            canFollow={Boolean(viewer) && !own}
            signedIn={Boolean(viewer)}
          />
          {own && stats.drafts !== null ? (
            <div className="small muted">
              {stats.drafts} private / unpublished draft{stats.drafts === 1 ? "" : "s"}
            </div>
          ) : null}
        </div>
      </header>
      <section className="flex flex-col gap-3" aria-labelledby="public-designs">
        <span id="public-designs" className="label">
          Public designs · {published.total}
        </span>
        {published.items.length === 0 ? (
          <div className="empty">
            No public designs yet.
            {own ? (
              <>
                {" "}
                <Link href="/new" className="link">
                  Create a design
                </Link>
                , or clone one from{" "}
                <Link href="/" className="link">
                  Browse
                </Link>
                .
              </>
            ) : null}
          </div>
        ) : (
          <ul className="rows">
            <RowsHead />
            {published.items.map((d) => (
              <DesignRow key={d.id} d={d} theme={theme} />
            ))}
          </ul>
        )}
        <Pager
          page={published.page}
          total={published.total}
          pageSize={published.pageSize}
          href={(p) => (p === 1 ? base : `${base}?page=${p}`)}
        />
      </section>
      {drafts && drafts.total > 0 ? (
        <CollapsibleSection name="profile-drafts" title="Your drafts" count={drafts.total}>
          <p className="small muted" style={{ marginBottom: "var(--sp-1-5)" }}>
            Private designs and designs never published. Only you see this.
            {drafts.total > drafts.items.length ? (
              <>
                {" "}
                <Link href={`/?q=@${user.username}`} className="link">
                  See all your designs
                </Link>
                .
              </>
            ) : null}
          </p>
          <ul className="rows">
            <RowsHead />
            {drafts.items.map((d) => (
              <DesignRow key={d.id} d={d} theme={theme} />
            ))}
          </ul>
        </CollapsibleSection>
      ) : null}
    </div>
  );
}
