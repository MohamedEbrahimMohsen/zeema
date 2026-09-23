import Link from "next/link";
import { notFound } from "next/navigation";
import { Pager } from "@/components/Pager";
import { UserList } from "@/components/UserList";
import { ServiceError } from "@/lib/designs";
import { intParam } from "@/lib/http-guards";
import { listFollowing } from "@/lib/social";

export const dynamic = "force-dynamic";

// Public, like GitHub's: anyone may see who follows an account and whom it follows.
export default async function FollowingPage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const [{ username }, sp] = await Promise.all([params, searchParams]);
  const page = intParam(sp.page, { fallback: 1, min: 1, max: 10_000 });
  const result = await listFollowing(username, page).catch((e) => {
    if (e instanceof ServiceError && e.status === 404) notFound();
    throw e;
  });
  const { user } = result;
  const base = `/u/${user.username}/following`;
  return (
    <div className="flex flex-col gap-4" style={{ maxWidth: 640 }}>
      <div>
        <Link href={`/u/${user.username}`} className="small link">
          ← {user.displayName ?? user.username}
        </Link>
        <h1 className="display">Following</h1>
        <span className="label">
          @{user.username} · {result.total}
        </span>
      </div>
      <UserList users={result.users} empty={`@${user.username} does not follow anyone yet.`} />
      <Pager
        page={result.page}
        total={result.total}
        pageSize={result.pageSize}
        href={(p) => (p === 1 ? base : `${base}?page=${p}`)}
      />
    </div>
  );
}
