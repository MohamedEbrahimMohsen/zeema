// Writing notifications. The design service calls these after the action they report has
// succeeded (the service runs no transactions, so there is nothing to join); reading them is
// social.ts. Kept apart from social.ts so designs.ts can import it without a cycle.
//
// What is written, and to whom (docs/final-plan.md, section 14; the docs page
// concepts/profiles-and-notifications):
//
// - `design_cloned`: someone cloned your public design. Actor = the cloner, design = the source.
//   Never for a clone of your own design, never to a closed account.
// - `design_published_by_followed`: an author you follow released a public design (a first
//   publish, a new release, or a released design made public). One row per follower, the author
//   excluded, closed accounts excluded, and at most one per follower and design in 24 hours.
// - `design_findings_changed` and `design_renamed_link` are reserved in the enum and never written:
//   findings are computed when a design is read, so there is no moment at which a catalogue change
//   "changes" them for anyone to be told about.
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import type { Design } from "@/db/schema";

/** How long a follower is spared a second notice about the same design. */
export const PUBLISH_NOTICE_WINDOW = "24 hours";

type DesignRef = Pick<Design, "id" | "ownerId" | "visibility" | "title" | "slug">;

const payloadOf = (d: DesignRef) => JSON.stringify({ title: d.title, slug: d.slug });

/** Tell the owner of a public design that `clonerId` cloned it. */
export async function notifyClone(source: DesignRef, clonerId: string) {
  if (!source.ownerId || source.ownerId === clonerId || source.visibility !== "public") return;
  const db = await getDb();
  await db.execute(sql`
    insert into notifications (user_id, kind, actor_id, design_id, payload)
    select u.id, 'design_cloned', ${clonerId}, ${source.id}, ${payloadOf(source)}::jsonb
    from users u
    where u.id = ${source.ownerId} and u.deleted_at is null`);
}

/** Tell everyone following the author of `design` that it was released. One statement. */
export async function notifyFollowersOfPublish(design: DesignRef) {
  if (!design.ownerId || design.visibility !== "public") return;
  const db = await getDb();
  await db.execute(sql`
    insert into notifications (user_id, kind, actor_id, design_id, payload)
    select f.follower_id, 'design_published_by_followed', ${design.ownerId}, ${design.id},
           ${payloadOf(design)}::jsonb
    from follows f
    join users u on u.id = f.follower_id and u.deleted_at is null
    where f.followee_id = ${design.ownerId}
      and f.follower_id <> ${design.ownerId}
      and not exists (
        select 1 from notifications n
        where n.user_id = f.follower_id
          and n.kind = 'design_published_by_followed'
          and n.design_id = ${design.id}
          and n.created_at > now() - ${PUBLISH_NOTICE_WINDOW}::interval
      )`);
}

/** Emit after the action has succeeded: a notice that fails to write never undoes the action. */
export async function emit(what: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (e) {
    console.error(`notification (${what}) not written`, e);
  }
}
