import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/Icon";
import { PropertyTable } from "@/components/PropertyTable";
import { getCatalogue, getIcons } from "@/lib/catalogue";

export default async function ComponentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cat = getCatalogue();
  const c = cat.components[id];
  if (!c) notFound();
  const kind = cat.kinds[c.kind];
  const icons = getIcons();
  const loc = cat.locale.components[id] ?? {};
  const siblings = Object.values(cat.components)
    .filter((x) => x.kind === c.kind && x.id !== id)
    .sort((a, b) => a.provider.localeCompare(b.provider) || a.id.localeCompare(b.id));
  const props = { ...(kind?.properties ?? {}), ...c.properties };
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
            {loc.name ?? id}
            {c.provider !== "default" ? <span className="tag tag-mono">{c.provider}</span> : null}
            <span className="tag">{cat.locale.kinds[c.kind]?.name ?? c.kind}</span>
          </h1>
          <div className="mono meta">{id}</div>
          {loc.description ? <p className="muted">{loc.description}</p> : null}
        </div>
      </div>

      <section className="flex flex-col gap-2">
        <span className="label">
          Properties · {Object.keys(c.defaults).length} set by this component
        </span>
        <PropertyTable properties={props} overrides={c.defaults} />
      </section>

      <section className="flex flex-col gap-2">
        <span className="label">Use it in a design</span>
        <pre className="code">{`nodes:
  - { id: "${id.replace(/^(aws|azure|gcp|oci|cloudflare)-/, "")}", component: "${id}" }`}</pre>
      </section>

      {siblings.length ? (
        <section className="flex flex-col gap-2">
          <span className="label">
            Other {cat.locale.kinds[c.kind]?.name ?? c.kind} products · {siblings.length}
          </span>
          <div className="list">
            {siblings.slice(0, 40).map((s) => (
              <Link key={s.id} href={`/catalogue/components/${s.id}`} className="row no-underline">
                <Icon markup={icons[s.id] ?? icons[`kind:${s.kind}`]} />
                <span className="flex items-baseline gap-2 min-w-0">
                  <span className="name">{cat.locale.components[s.id]?.name ?? s.id}</span>
                  <span className="slug truncate">{s.id}</span>
                </span>
                {s.provider !== "default" ? (
                  <span className="tag tag-mono">{s.provider}</span>
                ) : (
                  <span />
                )}
                <span className="kind">{s.kind}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
