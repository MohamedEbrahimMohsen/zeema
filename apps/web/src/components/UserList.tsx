import Link from "next/link";
import type { PublicUser } from "@/lib/social";
import { UserAvatar } from "./UserAvatar";

// A plain list of accounts, each linking to its profile: the followers and following pages.
export function UserList({ users, empty }: { users: PublicUser[]; empty: string }) {
  if (users.length === 0) return <div className="empty">{empty}</div>;
  return (
    <ul className="list user-list">
      {users.map((u) => (
        <li key={u.username}>
          <Link href={`/u/${u.username}`} className="user-row no-underline">
            <UserAvatar user={u} size={32} />
            <span className="flex min-w-0 flex-col">
              <strong className="truncate">{u.displayName ?? u.username}</strong>
              <span className="mono meta truncate">@{u.username}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
