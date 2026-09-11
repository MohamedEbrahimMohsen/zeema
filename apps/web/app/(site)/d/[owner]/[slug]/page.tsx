import { normalize } from "@arkore/core/document";
import { toSvg } from "@arkore/core/render";
import { parse } from "@arkore/core/yaml";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DesignActions } from "@/components/DesignActions";
import { Findings } from "@/components/Findings";
import { currentUser } from "@/lib/auth";
import { getCatalogue, getIcons } from "@/lib/catalogue";
import {
  getBrokenVersion,
  getDesign,
  ownerSegment,
  recordEvent,
  ServiceError,
} from "@/lib/designs";
import { analyse } from "@/lib/lint";

export const dynamic = "force-dynamic";

type Params = { owner: string; slug: string };

export default async function DesignPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<{ v?: string; broken?: string }>;
}) {
  const { owner, slug } = await params;
  const sp = await searchParams;
  const viewer = await currentUser();
  let view: Awaited<ReturnType<typeof getDesign>>;
  try {
    view = await getDesign(owner, slug, viewer, { version: sp.v });
  } catch (e) {
    if (e instanceof ServiceError && e.status === 404) notFound();
    throw e;
  }
  const cat = getCatalogue();
  let version = view.version;
  const broken = sp.broken ? await getBrokenVersion(view.design.id) : null;
  if (broken) version = broken;
  const yaml = version?.yaml ?? "";
  const { doc, findings } = analyse(yaml, cat);
  const svg = doc
    ? toSvg(normalize(parse(yaml).doc).doc, cat, { icons: getIcons(), theme: "auto" })
    : "";
  void recordEvent(view.design.id, viewer, "view").catch(() => {});
  const hasBroken =
    view.design.origin === "reference" && (await getBrokenVersion(view.design.id)) !== null;
  const ownerSeg = ownerSegment(view.owner);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="muted text-sm">
            {view.owner ? (
              <Link href={`/u/${view.owner.username}`}>@{view.owner.username}</Link>
            ) : (
              <span>arkore · {view.design.origin}</span>
            )}
            {" / "}
            <span className="mono">{view.design.slug}</span>
          </div>
          <h1 className="text-2xl font-semibold">{view.design.title}</h1>
          {view.design.summary ? <p className="muted mt-1">{view.design.summary}</p> : null}
          <div className="muted mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <span>{doc?.nodes.length ?? 0} components</span>
            <span>{doc?.edges.length ?? 0} edges</span>
            <span>{doc?.groups?.length ?? 0} boundaries</span>
            <span>{view.stats.viewCount} views</span>
            <span>{view.stats.cloneCount} clones</span>
            <span>{view.stats.exportCount} exports</span>
            <span className="tag">{view.design.visibility}</span>
            {broken ? <span className="tag sev-error">broken twin</span> : null}
          </div>
        </div>
        <DesignActions
          owner={ownerSeg}
          slug={view.design.slug}
          canWrite={view.can.write}
          canClone={view.can.clone}
          signedIn={Boolean(viewer)}
          visibility={view.design.visibility}
          isCurated={view.design.origin !== "authored"}
        />
      </div>
      {hasBroken ? (
        <div className="text-sm">
          {broken ? (
            <Link href={`/d/${ownerSeg}/${slug}`}>← Back to the clean design</Link>
          ) : (
            <Link href={`/d/${ownerSeg}/${slug}?broken=1`}>
              See the deliberately broken twin and the rules it trips →
            </Link>
          )}
        </div>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <section className="panel svg-preview overflow-auto p-2">
            {/* biome-ignore lint/security/noDangerouslySetInnerHtml: SVG produced by the engine from escaped data */}
            <div dangerouslySetInnerHTML={{ __html: svg }} />
          </section>
          <details className="panel p-4">
            <summary className="cursor-pointer font-medium">YAML</summary>
            <pre className="mono mt-3 overflow-x-auto text-xs leading-5">{yaml}</pre>
          </details>
        </div>
        <aside className="space-y-4">
          <Findings findings={findings} />
          {doc?.requirements ? (
            <section className="panel p-4 text-sm">
              <h2 className="font-medium">Promises</h2>
              <ul className="mt-2 space-y-1">
                {Object.entries(doc.requirements).flatMap(([group, paths]) =>
                  Object.entries(paths).map(([k, v]) => (
                    <li key={`${group}.${k}`} className="flex justify-between gap-2">
                      <span className="mono text-xs">
                        {group}.{k}
                      </span>
                      <span>{String(v)}</span>
                    </li>
                  )),
                )}
              </ul>
            </section>
          ) : null}
          <section className="panel p-4 text-sm">
            <h2 className="font-medium">Components</h2>
            <ul className="mt-2 space-y-1">
              {doc?.nodes.map((n) => {
                const c = cat.components[n.component];
                return (
                  <li key={n.id} className="flex justify-between gap-2">
                    <span>{n.label ?? n.id}</span>
                    <span className="muted mono text-xs">
                      {cat.locale.components[n.component]?.name ?? n.component}
                      {c && c.provider !== "default" ? ` · ${c.provider}` : ""}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
