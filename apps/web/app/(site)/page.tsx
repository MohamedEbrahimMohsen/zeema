import Link from "next/link";
import { DesignCard } from "@/components/DesignCard";
import { currentUser } from "@/lib/auth";
import { getCatalogue } from "@/lib/catalogue";
import { listDesigns } from "@/lib/designs";

export const dynamic = "force-dynamic";

export default async function Home() {
  const viewer = await currentUser();
  const cat = getCatalogue();
  const featured = await listDesigns(viewer, { sort: "clones", pageSize: 6 });
  return (
    <div className="flex flex-col gap-10">
      <section className="grid gap-8 md:grid-cols-2 md:items-center">
        <div className="flex flex-col gap-4">
          <h1 className="display">Architecture as typed, queryable data.</h1>
          <p className="muted" style={{ fontSize: "var(--fs-lead)" }}>
            A diagram is a picture. An Arkore design is a model: every box is a catalogued component
            with real properties, every promise the system makes is written down, and rules check
            the two against each other.
          </p>
          <div className="flex gap-2">
            <Link href="/browse" className="btn btn-primary no-underline">
              Browse designs
            </Link>
            <Link href={viewer ? "/new" : "/signin?next=/new"} className="btn no-underline">
              Create your own
            </Link>
          </div>
          <dl className="grid grid-cols-3 gap-3 pt-2">
            {[
              [Object.keys(cat.kinds).length, "kinds"],
              [Object.keys(cat.components).length.toLocaleString(), "components"],
              [cat.rules.length, "rules"],
            ].map(([n, k]) => (
              <div key={String(k)}>
                <dt className="title">{n}</dt>
                <dd className="label">{k}</dd>
              </div>
            ))}
          </dl>
        </div>
        <pre className="code">{`schemaVersion: "1"
type: "design"
id: "checkout"
requirements: { messaging: { replay: true } }
nodes:
  - { id: "api", component: "aws-api-gateway" }
  - { id: "events", component: "sns" }
edges:
  - { from: "api", to: "events", protocol: "sns",
      mode: "async", delivery: "at-least-once" }

# pubsub-replay-required fires: the design
# requires replay, and SNS cannot replay.`}</pre>
      </section>
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <span className="label">Most cloned</span>
          <Link href="/browse" className="small link">
            See all
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featured.items.map((d) => (
            <DesignCard key={d.id} d={d} />
          ))}
        </div>
      </section>
    </div>
  );
}
