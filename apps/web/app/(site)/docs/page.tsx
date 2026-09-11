const SECTIONS = [
  ["layers", "Three layers"],
  ["rules", "Rules"],
  ["writing", "Writing a design"],
  ["repo", "In your repository"],
  ["site", "On this site"],
];

export default function Docs() {
  return (
    <div className="grid gap-8 lg:grid-cols-[180px_minmax(0,1fr)]">
      <nav className="hidden lg:flex flex-col gap-2 sticky top-6 self-start">
        <span className="label">Contents</span>
        {SECTIONS.map(([id, t]) => (
          <a key={id} href={`#${id}`} className="small muted">
            {t}
          </a>
        ))}
      </nav>
      <article className="prose max-w-3xl flex flex-col gap-6">
        <h1 className="display">How Arkore works</h1>
        <section id="layers">
          <h2>Three layers</h2>
          <p>
            A <b>kind</b> is an abstract category with typed properties: a queue has a delivery
            guarantee, an ordering and a dead-letter flag. A <b>component</b> is a concrete product
            of exactly one kind, with the defaults that product really has: Kafka replays, SNS does
            not. A <b>design</b> names components as nodes, wires them with directed edges, nests
            them in boundaries, and states the promises the system makes under{" "}
            <code>requirements</code>.
          </p>
        </section>
        <section id="rules">
          <h2>Rules</h2>
          <p>
            Rules are declarative predicates over a design. They read a node&apos;s effective
            properties (the node&apos;s own values, then the component&apos;s defaults, then the
            kind&apos;s default), its edges, its boundaries and the design&apos;s requirements. A
            rule finding never blocks a save; a structural problem always does.
          </p>
        </section>
        <section id="writing">
          <h2>Writing a design</h2>
          <pre className="code">{`schemaVersion: "1"
type: "design"
id: "order-processing"
requirements:
  availability: { multiRegion: true, sla: "99.95" }
  messaging:    { replay: true }
groups:
  - { id: "eu-west-1", kind: "region" }
  - { id: "core-vpc",  kind: "vpc", parent: "eu-west-1" }
nodes:
  - id: "orders-queue"
    component: "kafka"
    group: "core-vpc"
    props: { deadLetterQueue: false, partitions: 12 }
    nfr:   { rps: 500 }
  - { id: "api", component: "aws-api-gateway" }
edges:
  - { from: "api", to: "orders-queue", protocol: "kafka", mode: "async", delivery: "at-least-once" }`}</pre>
          <ul className="small">
            <li>
              Quote every string. Ids and enum values are kebab-case; property names are camelCase.
            </li>
            <li>
              Every node names a component from the catalogue. Every edge joins two nodes and has a
              protocol and a mode.
            </li>
            <li>
              Boundaries nest through <code>parent</code>: region, availability-zone, vpc,
              trust-zone, system, cell, point-of-presence.
            </li>
            <li>
              Positions are never in the design. The picture is computed, or kept in a layout
              sidecar beside the file.
            </li>
          </ul>
        </section>
        <section id="repo">
          <h2>In your repository</h2>
          <pre className="code">{`npx @arkore/cli init          # starter design, config, editor schema mapping, CI workflow
npx @arkore/cli lint          # structure and rules; exit 1 on errors
npx @arkore/cli render architecture/checkout.arkore.yaml --format svg`}</pre>
        </section>
        <section id="site">
          <h2>On this site</h2>
          <p className="small">
            Reading is free. Sign in with GitHub to create a design, clone any public one into your
            account, and choose whether yours is public. A public design is readable by everyone and
            editable only by you. Every save is a version.
          </p>
        </section>
      </article>
    </div>
  );
}
