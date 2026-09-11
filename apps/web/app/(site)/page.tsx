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
    <div className="space-y-10">
      <section className="grid gap-8 md:grid-cols-2 md:items-center">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Architecture as typed, queryable data.
          </h1>
          <p className="mt-3 text-lg" style={{ color: "var(--muted)" }}>
            A diagram is a picture. An Arkore design is a model: every box is a catalogued component
            with real properties, every promise the system makes is written down, and rules check
            the two against each other.
          </p>
          <div className="mt-5 flex gap-3">
            <Link href="/browse" className="btn btn-primary no-underline">
              Browse designs
            </Link>
            <Link href={viewer ? "/new" : "/signin?next=/new"} className="btn no-underline">
              Create your own
            </Link>
          </div>
          <dl className="muted mt-6 grid grid-cols-3 gap-3 text-sm">
            <div>
              <dt className="text-2xl font-semibold" style={{ color: "var(--ink)" }}>
                {Object.keys(cat.kinds).length}
              </dt>
              <dd>kinds</dd>
            </div>
            <div>
              <dt className="text-2xl font-semibold" style={{ color: "var(--ink)" }}>
                {Object.keys(cat.components).length.toLocaleString()}
              </dt>
              <dd>components</dd>
            </div>
            <div>
              <dt className="text-2xl font-semibold" style={{ color: "var(--ink)" }}>
                {cat.rules.length}
              </dt>
              <dd>rules</dd>
            </div>
          </dl>
        </div>
        <pre className="panel mono overflow-x-auto p-4 text-sm leading-6">{`schemaVersion: "1"
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
      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-medium">Most cloned</h2>
          <Link href="/browse" className="text-sm">
            See all
          </Link>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {featured.items.map((d) => (
            <DesignCard key={d.id} d={d} />
          ))}
        </div>
      </section>
    </div>
  );
}
