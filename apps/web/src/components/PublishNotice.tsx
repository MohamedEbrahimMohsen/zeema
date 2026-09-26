"use client";

// The owner's one pending decision, above the picture it concerns: the head has moved past the
// release. It goes away by itself once published, because the page it sits on is re-read.
import { type DesignActionsProps, useDesignCommands } from "./DesignActions";

type Props = Pick<DesignActionsProps, "owner" | "slug" | "visibility" | "plannedSlug"> & {
  neverPublished: boolean;
  /** When the unpublished changes began, already worded ("since 3h ago"). */
  since?: string;
};

export function PublishNotice({ neverPublished, since, ...props }: Props) {
  const { busy, error, moving, publish } = useDesignCommands(props);
  const { owner, plannedSlug } = props;
  return (
    <section className="notice" aria-label="Unpublished changes">
      <span className="notice-dot" aria-hidden="true" />
      <span className="notice-text">
        Unpublished changes{since ? <span className="notice-since"> · {since}</span> : null}
      </span>
      {error ? <span className="status status-err notice-error">{error}</span> : null}
      <button
        type="button"
        className="btn btn-sm btn-primary notice-action"
        onClick={publish}
        disabled={busy !== null}
        title={`${
          neverPublished
            ? "Release this version; it shows to others once the design is public"
            : "Release the current draft; readers see the previous release until then"
        }${moving ? `. This draft moves to /d/${owner}/${plannedSlug}` : ""}`}
      >
        {busy === "publish" ? "publishing…" : "Publish"}
      </button>
    </section>
  );
}
