import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/Icon";
import { PropertyTable } from "@/components/PropertyTable";
import { Facts, RuleList, Source } from "@/components/Reference";
import { getCatalogue, getIcons } from "@/lib/catalogue";
import { componentDoc } from "@/lib/reference";

export default async function ComponentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = componentDoc(id);
  if (!doc) notFound();
  const cat = getCatalogue();
  const c = cat.components[id];
  const icons = getIcons();

  return (
    <div className="flex flex-col gap-6">
      <div className="meta">
        <Link href="/catalogue" className="link">
          Catalogue
        </Link>
        {" / "}
        <Link href={`/catalogue/kinds/${c.kind}`} className="link mono">
          {c.kind}
        </Link>
      </div>

      <div className="flex items-start gap-4">
        <Icon markup={icons[id] ?? icons[`kind:${c.kind}`]} size="lg" />
        <div className="flex flex-col gap-1 min-w-0">
          <h1 className="display flex items-baseline gap-3 flex-wrap">
            {doc.title}
            {c.provider !== "default" ? <span className="tag tag-mono">{c.provider}</span> : null}
            <span className="tag">{cat.locale.kinds[c.kind]?.name ?? c.kind}</span>
          </h1>
          <div className="mono meta">{id}</div>
          {doc.description ? <p className="muted">{doc.description}</p> : null}
        </div>
      </div>

      <Facts facts={doc.facts} />

      <section className="flex flex-col gap-2">
        <span className="label">Properties · {doc.properties?.caption}</span>
        <PropertyTable rows={doc.properties?.rows ?? []} />
      </section>

      <section className="flex flex-col gap-2">
        <span className="label">{doc.rules?.caption}</span>
        <p className="small muted">
          Every rule whose selector covers this component&apos;s kind or its category. Whether a
          rule fires depends on the design: its properties, its edges and its groups.
        </p>
        <RuleList
          items={doc.rules?.items ?? []}
          empty="No rule reads this kind yet. That is a gap, not a guarantee."
        />
      </section>

      <section className="flex flex-col gap-2">
        <span className="label">Use it in a design</span>
        <pre className="code">{`nodes:
  - { id: "${id.replace(/^(aws|azure|gcp|google|oci|cloudflare|ibm|alibaba|digitalocean|openstack|outscale|k8s)-/, "")}", component: "${id}" }`}</pre>
      </section>

      {doc.siblings?.items.length ? (
        <section className="flex flex-col gap-2">
          <span className="label">
            Other {cat.locale.kinds[c.kind]?.name ?? c.kind} products · {doc.siblings.total}
          </span>
          <div className="list">
            {doc.siblings.items.map((s) => (
              <Link key={s.id} href={s.href} className="row no-underline">
                <Icon markup={icons[s.id] ?? icons[`kind:${c.kind}`]} />
                <span className="flex items-baseline gap-2 min-w-0">
                  <span className="name">{s.name}</span>
                  <span className="slug truncate">{s.id}</span>
                </span>
                {s.note !== "default" ? <span className="tag tag-mono">{s.note}</span> : <span />}
                <span className="kind">{c.kind}</span>
              </Link>
            ))}
          </div>
          {doc.siblings.total > doc.siblings.items.length ? (
            <Link href={doc.siblings.kindHref} className="small link">
              and {doc.siblings.total - doc.siblings.items.length} more →{" "}
              {cat.locale.kinds[c.kind]?.name ?? c.kind} page
            </Link>
          ) : null}
        </section>
      ) : null}

      <Source path={doc.path} source={doc.source} />
    </div>
  );
}
