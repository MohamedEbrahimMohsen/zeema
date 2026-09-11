import { getCatalogue } from "@/lib/catalogue";

export default function CataloguePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; kind?: string }>;
}) {
  return <CatalogueInner searchParams={searchParams} />;
}

async function CatalogueInner({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; kind?: string }>;
}) {
  const sp = await searchParams;
  const cat = getCatalogue();
  const q = (sp.q ?? "").toLowerCase().trim();
  const counts: Record<string, number> = {};
  for (const c of Object.values(cat.components)) counts[c.kind] = (counts[c.kind] ?? 0) + 1;
  const kinds = Object.values(cat.kinds).sort(
    (a, b) => a.category.localeCompare(b.category) || a.id.localeCompare(b.id),
  );
  const components =
    sp.kind || q
      ? Object.values(cat.components)
          .filter(
            (c) =>
              (!sp.kind || c.kind === sp.kind) &&
              (!q ||
                `${c.id} ${cat.locale.components[c.id]?.name ?? ""} ${cat.locale.components[c.id]?.description ?? ""}`
                  .toLowerCase()
                  .includes(q)),
          )
          .slice(0, 300)
      : [];
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Catalogue</h1>
      <p className="muted text-sm">
        {kinds.length} kinds, {Object.keys(cat.components).length.toLocaleString()} components
        across six providers, {cat.rules.length} rules. A kind is the abstract thing (a queue); a
        component is the concrete product (Kafka, SQS) with its real defaults.
      </p>
      <form className="flex gap-2" method="get">
        <input
          className="input"
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Search components"
        />
        {sp.kind ? <input type="hidden" name="kind" value={sp.kind} /> : null}
        <button className="btn btn-primary" type="submit">
          Search
        </button>
      </form>
      {components.length ? (
        <section className="panel p-4">
          <h2 className="font-medium">
            {components.length} component{components.length === 1 ? "" : "s"}
            {sp.kind ? ` of kind ${sp.kind}` : ""}
          </h2>
          <table className="mt-2 w-full text-sm">
            <tbody>
              {components.map((c) => (
                <tr key={c.id} className="border-t" style={{ borderColor: "var(--line)" }}>
                  <td className="py-1 pr-3">{cat.locale.components[c.id]?.name ?? c.id}</td>
                  <td className="mono muted py-1 pr-3 text-xs">{c.id}</td>
                  <td className="muted py-1 pr-3 text-xs">{c.provider}</td>
                  <td className="muted py-1 text-xs">{c.kind}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
      <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {kinds.map((k) => (
          <a key={k.id} href={`/catalogue?kind=${k.id}`} className="panel block p-3 no-underline">
            <div className="flex items-baseline justify-between">
              <span className="font-medium">{cat.locale.kinds[k.id]?.name ?? k.id}</span>
              <span className="tag">{k.category}</span>
            </div>
            <div className="muted mt-1 text-xs">
              {counts[k.id] ?? 0} components · {Object.keys(k.properties).length} properties
            </div>
          </a>
        ))}
      </section>
    </div>
  );
}
