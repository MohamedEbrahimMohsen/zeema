import { notFound } from "next/navigation";
import { IamTable } from "@/components/IamTable";
import { actingAdmin, currentUser } from "@/lib/auth";
import { listUsers } from "@/lib/iam";

export const dynamic = "force-dynamic";

// Roles. Reachable only while acting as admin; everyone else gets the same 404 a private
// design gives, so the page's existence is not advertised.
export default async function IamPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; admins?: string }>;
}) {
  const viewer = await currentUser();
  if (!actingAdmin(viewer)) notFound();
  const sp = await searchParams;
  const onlyAdmins = sp.admins === "1";
  const users = await listUsers(viewer, { q: sp.q, onlyAdmins });
  const admins = users.filter((u) => u.roles.includes("admin")).length;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-4">
        <h1 className="title">IAM</h1>
        <span className="small muted">
          {users.length} user{users.length === 1 ? "" : "s"} shown · {admins} admin
          {admins === 1 ? "" : "s"}
        </span>
      </div>
      <p className="small muted" style={{ maxWidth: 640 }}>
        Admins edit the curated system designs and can see every private design. The role is off
        when an admin signs in; they switch it on from their account menu for one session.
      </p>
      <IamTable users={users} q={sp.q ?? ""} onlyAdmins={onlyAdmins} me={viewer!.username} />
    </div>
  );
}
