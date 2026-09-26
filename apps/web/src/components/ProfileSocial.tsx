"use client";

// The profile's numbers and its Follow button. One client component so a follow moves the
// follower count in the same frame as the button: optimistic, and put back if the server refuses.
import Link from "next/link";
import { useState } from "react";
import type { ProfileStats } from "@/lib/designs";

type Props = {
  username: string;
  stats: ProfileStats;
  following: boolean;
  /** Signed in, and not this profile's owner. */
  canFollow: boolean;
  signedIn: boolean;
};

export function ProfileSocial({ username, stats, following: initial, canFollow, signedIn }: Props) {
  const [following, setFollowing] = useState(initial);
  const [followers, setFollowers] = useState(stats.followers);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const base = `/u/${encodeURIComponent(username)}`;

  const toggle = async () => {
    const next = !following;
    setBusy(true);
    setError(null);
    setFollowing(next);
    setFollowers((n) => Math.max(0, n + (next ? 1 : -1)));
    try {
      const res = await fetch(`/api/v1/users/${encodeURIComponent(username)}/follow`, {
        method: next ? "PUT" : "DELETE",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(body?.error?.message ?? `request failed (${res.status})`);
      }
    } catch (e) {
      setFollowing(!next);
      setFollowers((n) => Math.max(0, n + (next ? -1 : 1)));
      setError(e instanceof Error ? e.message : "request failed");
    } finally {
      setBusy(false);
    }
  };

  const n = (v: number) => v.toLocaleString("en-US");
  return (
    <div className="profile-social">
      <ul className="stat-row profile-stats" aria-label="Profile stats">
        <li className="stat-chip">
          <b className="stat-n">{n(stats.designs)}</b> design{stats.designs === 1 ? "" : "s"}
        </li>
        <li className="stat-chip">
          <b className="stat-n">{n(stats.clones)}</b> clone{stats.clones === 1 ? "" : "s"}
        </li>
        <li className="stat-chip">
          <Link href={`${base}/followers`} className="no-underline">
            <b className="stat-n">{n(followers)}</b> follower{followers === 1 ? "" : "s"}
          </Link>
        </li>
        <li className="stat-chip">
          <Link href={`${base}/following`} className="no-underline">
            <b className="stat-n">{n(stats.following)}</b> following
          </Link>
        </li>
      </ul>
      {canFollow ? (
        <button
          type="button"
          className={`btn btn-sm follow-btn${following ? " is-following" : " btn-primary"}`}
          aria-pressed={following}
          disabled={busy}
          onClick={() => void toggle()}
        >
          {following ? "Following" : "Follow"}
        </button>
      ) : !signedIn ? (
        <Link
          href={`/signin?next=${encodeURIComponent(base)}`}
          className="btn btn-sm btn-primary follow-btn no-underline"
          aria-disabled="true"
          title="Sign in to follow"
        >
          Follow
        </Link>
      ) : null}
      {error ? (
        <span className="small" role="alert" style={{ color: "var(--err)" }}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
