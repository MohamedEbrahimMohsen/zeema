"use client";

// Tags on the design page. A reader sees chips that link into browse; the owner sees the same
// chips with a remove button and a field to add another. Every add and every remove is saved
// immediately — there is no Save button to forget — and a refused save puts the old list back
// rather than leaving the screen claiming something the database does not hold.
//
// Slugifying happens here with the same rule the service applies (src/lib/slug.ts), so a chip
// never reads back differently from what was stored.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toTag } from "@/lib/slug";

const MAX_TAGS = 10;

type Props = {
  owner: string;
  slug: string;
  tags: string[];
  canWrite: boolean;
  /** Tags already used across the designs this viewer can see, commonest first. */
  suggestions: string[];
};

export function TagEditor({ owner, slug, tags, canWrite, suggestions }: Props) {
  const router = useRouter();
  const [shown, setShown] = useState(tags);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The list two keystrokes ago is not the list to add to: state updates land a render later,
  // and someone typing "a,b,c" quickly would otherwise overwrite their own first two tags.
  const latest = useRef(tags);
  const put = (next: string[]) => {
    latest.current = next;
    setShown(next);
  };

  // Saves go out one at a time. Two requests in flight with different lists would leave the
  // database holding whichever answered last, which is not necessarily the later edit.
  const queue = useRef<Promise<void>>(Promise.resolve());

  const save = (next: string[]) => {
    const prev = latest.current;
    put(next);
    setError(null);
    setBusy(true);
    queue.current = queue.current.then(async () => {
      const res = await fetch(`/api/v1/designs/${owner}/${slug}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tags: next }),
      });
      setBusy(false);
      if (!res.ok) {
        put(prev);
        const body = await res.json().catch(() => ({}));
        setError(body?.error?.message ?? `could not save tags (${res.status})`);
        return;
      }
      const body = await res.json().catch(() => null);
      if (body?.design?.tags) put(body.design.tags);
      router.refresh();
    });
  };

  /** Takes what was typed, whatever ended it: Enter, a comma, a paste of several, or a blur. */
  const add = (raw: string) => {
    const tag = toTag(raw);
    const now = latest.current;
    if (!tag || now.includes(tag) || now.length >= MAX_TAGS) return;
    save([...now, tag]);
  };

  if (!canWrite) {
    if (!shown.length) return null;
    return (
      <div className="tag-row">
        {shown.map((t) => (
          <Link key={t} href={`/?q=%23${encodeURIComponent(t)}`} className="tag tag-mono">
            {t}
          </Link>
        ))}
      </div>
    );
  }

  const full = shown.length >= MAX_TAGS;
  const offered = suggestions
    .filter((s) => !shown.includes(s) && (!typed || s.includes(toTag(typed))))
    .slice(0, 8);
  return (
    <div className="tag-row">
      {shown.map((t) => (
        <span key={t} className="tag tag-mono tag-chip">
          <Link href={`/?q=%23${encodeURIComponent(t)}`}>{t}</Link>
          <button
            type="button"
            className="tag-x"
            aria-label={`Remove ${t}`}
            disabled={busy}
            onClick={() => void save(latest.current.filter((x) => x !== t))}
          >
            ×
          </button>
        </span>
      ))}
      <input
        className="input tag-input"
        value={typed}
        list="tag-suggestions"
        disabled={full}
        aria-label="Add a tag"
        placeholder={full ? "10 max" : "add tag"}
        maxLength={64}
        onChange={(e) => {
          // A comma ends a tag, the way it does everywhere else that takes a list of words.
          // Reading it here rather than from a keystroke also handles a pasted "a, b, c".
          const parts = e.target.value.split(",");
          const tail = parts.pop() ?? "";
          for (const part of parts) add(part);
          setTyped(tail);
        }}
        onBlur={() => {
          add(typed);
          setTyped("");
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add(e.currentTarget.value);
            setTyped("");
          } else if (e.key === "Backspace" && !e.currentTarget.value && latest.current.length) {
            void save(latest.current.slice(0, -1));
          } else if (e.key === "Escape") setTyped("");
        }}
      />
      <datalist id="tag-suggestions">
        {offered.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      {full ? <span className="meta">10 max</span> : null}
      {error ? <span className="status status-err small">{error}</span> : null}
    </div>
  );
}
