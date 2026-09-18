"use client";

// The IAM page body: search users, see who holds the admin role, grant and revoke it.
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { IamUser } from "@/lib/iam";

type Props = { users: IamUser[]; q: string; onlyAdmins: boolean; me: string };

const when = (d: Date | string) =>
  new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

export function IamTable({ users, q, onlyAdmins, me }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const change = async (username: string, grant: boolean) => {
    if (
      !grant &&
      !confirm(`Revoke the admin role from @${username}? Their sessions drop to member at once.`)
    )
      return;
    setBusy(username);
    setError(null);
    try {
      const res = await fetch("/api/v1/admin/grants", {
        method: grant ? "POST" : "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, role: "admin" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? `${res.status}`);
      }
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <form className="flex flex-wrap items-center gap-3" method="get">
        <input
          className="input"
          style={{ maxWidth: 320 }}
          name="q"
          defaultValue={q}
          placeholder="Search by username or name"
        />
        <label className="flex items-center gap-2 small">
          <input type="checkbox" name="admins" value="1" defaultChecked={onlyAdmins} />
          Admins only
        </label>
        <button className="btn" type="submit">
          Filter
        </button>
        {error ? <span className="status status-err">{error}</span> : null}
      </form>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>User</th>
              <th>Joined</th>
              <th>Role</th>
              <th>Granted</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted">
                  No users match.
                </td>
              </tr>
            ) : null}
            {users.map((u) => {
              const admin = u.roles.includes("admin");
              const self = u.username === me;
              return (
                <tr key={u.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      {u.avatarUrl ? (
                        <img src={u.avatarUrl} alt="" width={24} height={24} className="avatar" />
                      ) : (
                        <span className="avatar avatar-fallback" aria-hidden="true">
                          {(u.displayName || u.username).charAt(0).toUpperCase()}
                        </span>
                      )}
                      <div className="flex flex-col">
                        <span className="medium">{u.displayName || u.username}</span>
                        <a href={`/u/${u.username}`} className="mono meta no-underline">
                          @{u.username}
                          {self ? " (you)" : ""}
                        </a>
                      </div>
                    </div>
                  </td>
                  <td className="muted">{when(u.createdAt)}</td>
                  <td>
                    {admin ? (
                      <span className="tag tag-accent">admin</span>
                    ) : (
                      <span className="tag">member</span>
                    )}
                  </td>
                  <td className="muted small">
                    {u.adminGrant
                      ? `${when(u.adminGrant.grantedAt)}${u.adminGrant.grantedBy ? ` by @${u.adminGrant.grantedBy}` : ""}${u.adminGrant.note ? ` · ${u.adminGrant.note}` : ""}`
                      : ""}
                  </td>
                  <td className="text-right">
                    {admin ? (
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        disabled={busy !== null || self}
                        title={self ? "Another admin has to revoke yours" : undefined}
                        onClick={() => void change(u.username, false)}
                      >
                        {busy === u.username ? "…" : "Revoke admin"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-sm"
                        disabled={busy !== null}
                        onClick={() => void change(u.username, true)}
                      >
                        {busy === u.username ? "…" : "Grant admin"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
