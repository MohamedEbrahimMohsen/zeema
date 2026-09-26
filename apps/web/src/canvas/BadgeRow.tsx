"use client";

// The owner's list badge, in the canvas's Design settings: what the corner of the design's list
// thumbnail wears, and the same chooser as the design page's `⋯` menu, laid inline. A pick is
// layout, like a group's tint: it only sets the sidecar's `badge`, and the canvas's own save
// carries it (never the design page's PATCH …/layout, which would cut a version of its own).
import { useRef, useState } from "react";
import { BadgeChooser, type BadgeMenuData, Mark } from "@/components/BadgePicker";

export function BadgeRow({
  data,
  onChoose,
}: {
  /** `current` and `auto` as the canvas holds them now; the choices as the server sent them. */
  data: BadgeMenuData;
  onChoose: (ref: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const chosen = data.current
    ? [...data.providers, ...data.boundaries].find((c) => c.ref === data.current)
    : undefined;
  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  };
  return (
    <div className="badge-row">
      <div className={`field${chosen ? " set" : ""}`} data-field="badge">
        <div className="field-name">List badge</div>
        <div className="badge-row-value">
          <span className="badge-now">
            {chosen ? (
              <>
                <span className="badge-mark">
                  <Mark markup={chosen.markup} />
                </span>
                <span className="badge-row-name">{chosen.name}</span>
              </>
            ) : (
              <>
                {data.auto ? (
                  <span className="badge-mark">
                    <Mark markup={data.auto.markup} />
                  </span>
                ) : null}
                <span className="badge-row-name">
                  Automatic · {data.auto ? data.auto.name : "none"}
                </span>
              </>
            )}
          </span>
          <button
            ref={trigger}
            type="button"
            className="btn btn-sm"
            aria-haspopup="dialog"
            aria-expanded={open}
            onMouseDown={(e) => {
              // The chooser closes itself on a press outside it; this button is outside it, so
              // without this a press to close would close and then reopen it.
              if (open) e.stopPropagation();
            }}
            onClick={() => setOpen((o) => !o)}
          >
            Change…
          </button>
        </div>
      </div>
      {open ? (
        <BadgeChooser
          inline
          data={data}
          onChoose={(ref) => {
            onChoose(ref);
            return ref;
          }}
          onClose={close}
        />
      ) : null}
    </div>
  );
}
