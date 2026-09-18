import { normalize } from "@zeema/core/document";
import { toSvg } from "@zeema/core/render";
import { parse } from "@zeema/core/yaml";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DesignActions } from "@/components/DesignActions";
import { EditableTitle } from "@/components/EditableTitle";
import { Findings } from "@/components/Findings";
import { Icon } from "@/components/Icon";
import { currentUser } from "@/lib/auth";
import { getCatalogue, getIcons } from "@/lib/catalogue";
import {
  getBrokenVersion,
  getDesign,
  listVersions,
  ownerSegment,
  recordEvent,
  ServiceError,
} from "@/lib/designs";
import { analyse } from "@/lib/lint";

export const dynamic = "force-dynamic";

type Params = { owner: string; slug: string };

const when = (d: Date) =>
  d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

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
  const icons = getIcons();
  let version = view.version;
  const broken = sp.broken ? await getBrokenVersion(view.design.id) : null;
  if (broken) version = broken;
  const yaml = version?.yaml ?? "";
  const { doc, findings } = analyse(yaml, cat);
  // The engine's own <style> carries :root variables; strip it so the picture follows the page
  // theme — globals.css restates the class rules under .svg-preview.
  const svg = doc
    ? toSvg(normalize(parse(yaml).doc).doc, cat, { icons, theme: "light" }).replace(
        /<style>[\s\S]*?<\/style>/,
        "",
      )
    : "";
  void recordEvent(view.design.id, viewer, "view").catch(() => {});
  const hasBroken =
    view.design.origin === "reference" && (await getBrokenVersion(view.design.id)) !== null;
  const ownerSeg = ownerSegment(view.owner);
  const versions = await listVersions(view);
  const currentId = view.design.currentVersionId;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1 flex flex-col gap-1">
          <div className="meta">
            {view.owner ? (
              <Link href={`/u/${view.owner.username}`} className="link">
                @{view.owner.username}
              </Link>
            ) : (
              <span>zeema · {view.design.origin}</span>
            )}
            {" / "}
            <span className="mono">{view.design.slug}</span>
          </div>
          <h1 className="display flex items-baseline gap-3 flex-wrap">
            <EditableTitle
              owner={ownerSeg}
              slug={view.design.slug}
              title={view.design.title}
              canWrite={view.can.write && view.design.origin === "authored"}
            />
            <span className="tag">{view.design.visibility}</span>
            {view.unpublished && !sp.v ? (
              <span className="tag tag-accent" title="Readers see the last release">
                draft
              </span>
            ) : null}
            {sp.v && version?.publishedAt ? <span className="tag">released</span> : null}
            {sp.v && !version?.publishedAt ? <span className="tag">unreleased</span> : null}
            {broken ? <span className="tag tag-danger">broken twin</span> : null}
          </h1>
          {view.design.summary ? <p className="muted">{view.design.summary}</p> : null}
          <div className="card-strip pt-1">
            <span>{doc?.nodes.length ?? 0} components</span>
            <span>·</span>
            <span>{doc?.edges.length ?? 0} edges</span>
            <span>·</span>
            <span>{doc?.groups?.length ?? 0} boundaries</span>
            <span>·</span>
            <span>{view.stats.viewCount} views</span>
            <span>·</span>
            <span>{view.stats.cloneCount} clones</span>
            <span>·</span>
            <span>{view.stats.exportCount} exports</span>
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
          unpublished={view.unpublished}
          neverPublished={!view.published}
        />
      </div>
      {view.can.write && view.unpublished ? (
        <div className="small muted">
          {view.published
            ? "This is your draft. Readers see the release from "
            : "Not released yet. Readers see nothing until you publish"}
          {view.published ? (
            <>
              {when(view.published.publishedAt ?? view.published.createdAt)}
              {view.design.visibility === "public" ? "" : " (once the design is public)"}.
            </>
          ) : view.design.visibility === "public" ? (
            "."
          ) : (
            " and make the design public."
          )}
        </div>
      ) : null}
      {hasBroken ? (
        <div className="small">
          {broken ? (
            <Link href={`/d/${ownerSeg}/${slug}`} className="link">
              ← Back to the clean design
            </Link>
          ) : (
            <Link href={`/d/${ownerSeg}/${slug}?broken=1`} className="link">
              See the deliberately broken twin and the rules it trips →
            </Link>
          )}
        </div>
      ) : null}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-5 min-w-0">
          <section className="panel svg-preview p-2">
            {/* biome-ignore lint/security/noDangerouslySetInnerHtml: SVG produced by the engine from escaped data */}
            <div dangerouslySetInnerHTML={{ __html: svg }} />
          </section>
          <details className="disclosure">
            <summary>
              YAML <span className="count mono">{yaml.split("\n").length} lines</span>
            </summary>
            <pre className="body code" style={{ border: 0, padding: "var(--sp-1) 0 0" }}>
              {yaml}
            </pre>
          </details>
        </div>
        <aside className="flex flex-col gap-4">
          <Findings findings={findings} />
          {doc?.requirements ? (
            <section className="panel p-4 flex flex-col gap-2">
              <span className="label">Promises</span>
              <ul className="flex flex-col gap-1 small">
                {Object.entries(doc.requirements).flatMap(([group, paths]) =>
                  Object.entries(paths).map(([k, v]) => (
                    <li key={`${group}.${k}`} className="flex justify-between gap-2 mono">
                      <span className="muted">
                        {group}.{k}
                      </span>
                      <span>{String(v)}</span>
                    </li>
                  )),
                )}
              </ul>
            </section>
          ) : null}
          <section className="panel p-4 flex flex-col gap-2">
            <span className="label">Components · {doc?.nodes.length ?? 0}</span>
            <ul className="flex flex-col gap-2 small">
              {doc?.nodes.map((n) => {
                const c = cat.components[n.component];
                return (
                  <li key={n.id} className="flex items-center gap-2 min-w-0">
                    <Icon
                      markup={icons[n.component] ?? (c ? icons[`kind:${c.kind}`] : undefined)}
                      size="sm"
                    />
                    <span className="medium truncate">{n.label ?? n.id}</span>
                    <Link
                      href={`/catalogue/components/${n.component}`}
                      className="ml-auto mono meta truncate no-underline"
                    >
                      {n.component}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
          {versions.length > 1 || (view.can.write && versions.length > 0) ? (
            <section className="panel p-4 flex flex-col gap-2">
              <span className="label">
                {view.can.write ? "History" : "Releases"} · {versions.length}
              </span>
              <ul className="flex flex-col gap-1 small">
                {versions.slice(0, 12).map((v) => {
                  const active = (sp.v ?? currentId) === v.id;
                  return (
                    <li key={v.id} className="flex items-center gap-2">
                      <Link
                        href={
                          v.id === currentId
                            ? `/d/${ownerSeg}/${slug}`
                            : `/d/${ownerSeg}/${slug}?v=${v.id}`
                        }
                        className={`mono no-underline ${active ? "" : "muted"}`}
                      >
                        {v.contentHash.slice(0, 8)}
                      </Link>
                      <span className="muted">{when(v.createdAt)}</span>
                      {v.id === view.design.publishedVersionId ? (
                        <span className="tag tag-accent ml-auto">released</span>
                      ) : v.id === currentId && view.can.write ? (
                        <span className="tag ml-auto">draft</span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
