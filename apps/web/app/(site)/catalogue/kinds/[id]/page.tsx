import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/Icon";
import { PropertyTable } from "@/components/PropertyTable";
import { Facts, RuleList, Source } from "@/components/Reference";
import { getCatalogue, getIcons } from "@/lib/catalogue";
import { kindDoc } from "@/lib/reference";

export default async function KindPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = kindDoc(id);
  if (!doc) notFound();
  const cat = getCatalogue();
  const kind = cat.kinds[id];
  const icons = getIcons();

  return (
    <div className="flex flex-col gap-6">
      <div className="meta">
        <Link href="/catalogue" className="link">
          Catalogue
        </Link>
        {" / "}
        <span className="mono">{cat.locale.categories[kind.category]?.name ?? kind.category}</span>
      </div>

      <div className="flex items-start gap-4">
        <Icon markup={icons[`kind:${id}`]} size="lg" />
        <div className="flex flex-col gap-1 min-w-0">
          <h1 className="display flex items-baseline gap-3">
            {doc.title}
            <span className="tag">{kind.category}</span>
          </h1>
          <div className="mono meta">{id}</div>
          {doc.description ? <p className="muted">{doc.description}</p> : null}
        </div>
      </div>

      <Facts facts={doc.facts} />

      <section className="flex flex-col gap-2">
        <span className="label">Properties · {doc.properties?.caption}</span>
        <p className="small muted">
          A node of this kind resolves each property from its own <code>props</code>, then the
          component&apos;s defaults, then the default below.
        </p>
        <PropertyTable rows={doc.properties?.rows ?? []} />
      </section>

      <section className="flex flex-col gap-2">
        <span className="label">{doc.rules?.caption}</span>
        <RuleList
          items={doc.rules?.items ?? []}
          empty="No rule selects this kind or its category. Governance calls that a recorded gap."
        />
      </section>

      <section className="flex flex-col gap-3">
        <span className="label">
          Components · {doc.componentGroups?.reduce((n, g) => n + g.items.length, 0) ?? 0}
        </span>
        {doc.componentGroups?.map((g) => (
          <div key={g.provider} className="flex flex-col gap-2">
            <span className="meta mono">{g.provider}</span>
            <div className="list">
              {g.items.map((c) => (
                <Link key={c.id} href={c.href} className="row no-underline">
                  <Icon markup={icons[c.id] ?? icons[`kind:${id}`]} />
                  <span className="flex items-baseline gap-2 min-w-0">
                    <span className="name">{c.name}</span>
                    <span className="slug truncate">{c.id}</span>
                  </span>
                  {g.provider === "vendor-neutral" ? (
                    <span className="tag tag-mono">generic</span>
                  ) : (
                    <span />
                  )}
                  <span className="kind">{c.note}</span>
                </Link>
              ))}
            </div>
          </div>
        ))}
        {/* How many designs use this kind is deliberately not here: it is one database query per
            kind against the platform, and this page is catalogue data only. */}
      </section>

      <Source path={doc.path} source={doc.source} />
    </div>
  );
}
