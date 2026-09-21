// A note, a tip or a warning: the aside a docs page uses for the thing that does not fit the
// sentence it interrupts. An accent bar down the left, a glyph, and the body rendered as ordinary
// documentation Markdown, so a callout can hold a link, a list or a code sample like any prose.

import { DocsMarkdown } from "@/components/DocsMarkdown";
import { Alert, Bulb, Info } from "@/components/Glyphs";

const TONE = {
  note: { label: "Note", Glyph: Info },
  tip: { label: "Tip", Glyph: Bulb },
  warning: { label: "Warning", Glyph: Alert },
} as const;

export function Callout({ tone, children }: { tone: keyof typeof TONE; children: string }) {
  const { label, Glyph } = TONE[tone];
  return (
    <aside className={`callout callout-${tone}`}>
      <p className="callout-head">
        <Glyph />
        <span>{label}</span>
      </p>
      <DocsMarkdown>{children}</DocsMarkdown>
    </aside>
  );
}
