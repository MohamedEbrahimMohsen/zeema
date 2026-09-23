import { normalize } from "@zeema/core/document";
import { toSvg } from "@zeema/core/render";
import { parse } from "@zeema/core/yaml";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { DesignActions } from "@/components/DesignActions";
import { DesignPreview } from "@/components/DesignPreview";
import { DiscardDraft } from "@/components/DiscardDraft";
import { EditableSlug } from "@/components/EditableSlug";
import { EditableSummary } from "@/components/EditableSummary";
import { EditableTitle } from "@/components/EditableTitle";
import { Findings } from "@/components/Findings";
import { Icon } from "@/components/Icon";
import { Markdown } from "@/components/Markdown";
import { Readme } from "@/components/Readme";
import { TagEditor } from "@/components/TagEditor";
import { YamlSection } from "@/components/YamlSection";
import { firstInHour } from "@/lib/api";
import { currentUser } from "@/lib/auth";
import { getCatalogue, getIcons } from "@/lib/catalogue";
import {
  getBrokenVersion,
  getDesign,
  getTombstone,
  listTags,
  listVersions,
  ownerSegment,
  publishSlugFor,
  recordEvent,
  resolveAlias,
  ServiceError,
} from "@/lib/designs";
import { clientIp } from "@/lib/http-guards";
import { readSidecar } from "@/lib/layout-sidecar";
import { analyse } from "@/lib/lint";
import { own } from "@/lib/own";

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
    if (e instanceof ServiceError && e.status === 404) {
      // The design may have been renamed: an old address redirects to the current one.
      const now = await resolveAlias(owner, slug);
      if (now) redirect(`/d/${owner}/${now}`);
      // Or it was published and then removed, in which case say so rather than pretending the
      // address never existed: people arriving from an old link deserve to know what happened.
      const gone = await getTombstone(owner, slug);
      if (gone) return <Tombstone gone={gone} />;
      notFound();
    }
    throw e;
  }
  const cat = getCatalogue();
  const icons = getIcons();
  let version = view.version;
  const broken = sp.broken ? await getBrokenVersion(view.design.id) : null;
  if (broken) version = broken;
  const yaml = version?.yaml ?? "";
  const { doc, findings } = analyse(yaml, cat);
  // The picture is the one its owner drew: the layout sidecar of the version on screen decides
  // where the boxes are, and the engine arranges the design itself only when no canvas has. The
  // preview panel strips the engine's own <style> so the drawing follows the page theme.
  const svg = doc
    ? toSvg(normalize(parse(yaml).doc).doc, cat, {
        icons,
        theme: "light",
        layout: readSidecar(version?.layout),
      })
    : "";
  // One view per visitor and hour: cheap in-process first, then the event log itself decides.
  const ip = clientIp(await headers());
  if (firstInHour(`view:${viewer?.id ?? ip}:${view.design.id}`))
    void recordEvent(view.design.id, viewer, "view", { ip }).catch(() => {});
  const hasBroken =
    view.design.origin === "reference" && (await getBrokenVersion(view.design.id)) !== null;
  const ownerSeg = ownerSegment(view.owner);
  const versions = await listVersions(view);
  const currentId = view.design.currentVersionId;
  // The offers only exist for the owner's own field, so nobody else pays for the query.
  const tagSuggestions = view.can.write ? await listTags(viewer) : [];
  const readme = view.design.readme ?? "";
  // Going back to the release only makes sense for the owner of a published design whose head
  // has moved on, and never while an older version is the one on screen.
  // Either the head has moved on, or it has not but abandoned versions are still sitting behind
  // it (a design discarded before the discard deleted anything). Both are the owner's to clear.
  const canDiscard =
    view.can.write &&
    Boolean(view.published) &&
    !sp.v &&
    (view.unpublished || view.draftVersionCount > 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1 basis-[16rem] flex flex-col gap-1">
          <div className="meta">
            {view.owner ? (
              <Link href={`/u/${view.owner.username}`} className="link">
                @{view.owner.username}
              </Link>
            ) : (
              <span>zeema · {view.design.origin}</span>
            )}
            {" / "}
            <EditableSlug
              owner={ownerSeg}
              slug={view.design.slug}
              canWrite={view.can.write}
              published={Boolean(view.design.publishedAt)}
            />
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
          <EditableSummary
            owner={ownerSeg}
            slug={view.design.slug}
            summary={view.design.summary ?? ""}
            canWrite={view.can.write}
          />
          <TagEditor
            owner={ownerSeg}
            slug={view.design.slug}
            tags={view.design.tags ?? []}
            canWrite={view.can.write}
            suggestions={tagSuggestions}
          />
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
          plannedSlug={publishSlugFor({ slug: view.design.slug, title: view.design.title })}
        />
      </div>
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
      <div className="grid gap-5 grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-5 min-w-0">
          <DesignPreview
            owner={ownerSeg}
            slug={view.design.slug}
            canWrite={view.can.write}
            svg={svg}
          />
          <Readme
            owner={ownerSeg}
            slug={view.design.slug}
            readme={readme}
            canWrite={view.can.write}
          >
            {readme ? <Markdown>{readme}</Markdown> : null}
          </Readme>
          <YamlSection
            owner={ownerSeg}
            slug={view.design.slug}
            yaml={yaml}
            canWrite={view.can.write}
            version={sp.v}
          />
        </div>
        <aside className="flex flex-col gap-4">
          <Findings findings={findings} collapsible />
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
          <CollapsibleSection name="components" title="Components" count={doc?.nodes.length ?? 0}>
            <ul className="flex flex-col gap-2 small">
              {doc?.nodes.map((n) => {
                const c = own(cat.components, n.component);
                return (
                  <li key={n.id} className="flex items-center gap-2 min-w-0">
                    <Icon
                      markup={own(icons, n.component) ?? (c ? icons[`kind:${c.kind}`] : undefined)}
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
          </CollapsibleSection>
          {versions.length > 1 || (view.can.write && versions.length > 0) ? (
            <CollapsibleSection
              name="history"
              title={view.can.write ? "History" : "Releases"}
              count={versions.length}
              actions={
                canDiscard ? (
                  <DiscardDraft
                    owner={ownerSeg}
                    slug={view.design.slug}
                    releasedAt={when(
                      view.published?.publishedAt ?? view.published?.createdAt ?? new Date(),
                    )}
                    draftVersionCount={view.draftVersionCount}
                    headMoved={view.unpublished}
                  />
                ) : null
              }
            >
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
            </CollapsibleSection>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

// A removed design keeps its address so old links do not quietly resolve to someone else's work.
// The page is noindex rather than a 410: the App Router has no way to set that status from a
// page, and keeping crawlers off it is what the status would have been for.
function Tombstone({ gone }: { gone: NonNullable<Awaited<ReturnType<typeof getTombstone>>> }) {
  return (
    <div className="flex flex-col gap-4">
      <meta name="robots" content="noindex" />
      <h1 className="title">{gone.title}</h1>
      <p className="muted">
        This design was removed by its author on {when(gone.deletedAt)}. The address stays reserved,
        so links to it will not lead anywhere else.
      </p>
      <div className="flex gap-2">
        <Link href="/" className="btn btn-primary no-underline">
          Browse designs
        </Link>
        <Link href={`/u/${gone.owner}`} className="btn no-underline">
          More from @{gone.owner}
        </Link>
      </div>
    </div>
  );
}
