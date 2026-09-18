import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/Icon";
import { PropertyTable } from "@/components/PropertyTable";
import { getCatalogue, getIcons } from "@/lib/catalogue";

export default async function KindPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cat = getCatalogue();
  const kind = cat.kinds[id];
  if (!kind) notFound();
  const icons = getIcons();
  const loc = cat.locale.kinds[id] ?? {};
  const components = Object.values(cat.components)
    .filter((c) => c.kind === id)
    .sort((a, b) => a.provider.localeCompare(b.provider) || a.id.localeCompare(b.id));
  const rules = cat.rules.filter((r) => JSON.stringify(r.select).includes(`"${id}"`));
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
            {loc.name ?? id}
            <span className="tag">{kind.category}</span>
          </h1>
          <div className="mono meta">{id}</div>
          {loc.description ? <p className="muted">{loc.description}</p> : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="flex flex-col gap-2">
          <span className="label">Properties · {Object.keys(kind.properties).length}</span>
          <PropertyTable properties={kind.properties} />
        </section>
        <section className="flex flex-col gap-2">
          <span className="label">Rules that select this kind · {rules.length}</span>
          {rules.length ? (
            <div className="list">
              {rules.map((r) => (
                <Link
                  key={r.id}
                  href={`/catalogue/rules#${r.id}`}
                  className="row no-underline"
                  style={{ gridTemplateColumns: "10px 1fr auto" }}
                >
                  <span
                    className="dot"
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: r.severity === "error" ? "var(--err)" : "var(--warn)",
                    }}
                  />
                  <span className="flex flex-col min-w-0">
                    <span className="name">{cat.locale.rules[r.id]?.name ?? r.id}</span>
                    <span className="slug truncate">{r.id}</span>
                  </span>
                  <span className="kind">{r.severity}</span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty">No rule selects this kind on its own.</div>
          )}
        </section>
      </div>

      <section className="flex flex-col gap-2">
        <span className="label">Components · {components.length}</span>
        <div className="list">
          {components.map((c) => (
            <Link key={c.id} href={`/catalogue/components/${c.id}`} className="row no-underline">
              <Icon markup={icons[c.id] ?? icons[`kind:${id}`]} />
              <span className="flex items-baseline gap-2 min-w-0">
                <span className="name">{cat.locale.components[c.id]?.name ?? c.id}</span>
                <span className="slug truncate">{c.id}</span>
              </span>
              {c.provider !== "default" ? (
                <span className="tag tag-mono">{c.provider}</span>
              ) : (
                <span />
              )}
              <span className="kind">{Object.keys(c.defaults).length} defaults</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
