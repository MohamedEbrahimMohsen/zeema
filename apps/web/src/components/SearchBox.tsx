"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

// The one control that replaced the filter chips. It is an ordinary text input inside an
// ordinary GET form, so the page works without this component: the suggestions are a
// convenience on top, and everything they insert is text a person could have typed.
//
// Suggestions apply to the word the caret sits in. Typing `#` or `@` opens the list for that
// prefix; ↑/↓ move, Enter or Tab accepts, Escape closes. With nothing open, Enter submits.

export type Suggestion = { value: string; hint: string };

export function SearchBox({
  name = "q",
  defaultValue = "",
  owners,
  tags,
  placeholder,
}: {
  name?: string;
  defaultValue?: string;
  owners: string[];
  tags: Suggestion[];
  placeholder?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  // Suggestions are a response to typing, so a page that loads with a query in the box does not
  // open the list until the caret is actually in it.
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);
  const [caret, setCaret] = useState(defaultValue.length);
  const input = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const listId = useId();

  // The word under the caret, and where it starts, so accepting a suggestion replaces it.
  const word = useMemo(() => {
    const upto = value.slice(0, caret);
    const start = upto.lastIndexOf(" ") + 1;
    return { start, text: upto.slice(start) };
  }, [value, caret]);

  const matches = useMemo(() => {
    const w = word.text.toLowerCase();
    const pool: Suggestion[] = w.startsWith("@")
      ? owners.map((o) => ({ value: `@${o}`, hint: "owner" }))
      : w.startsWith("#")
        ? tags
        : [];
    if (!pool.length) return [];
    return pool.filter((s) => s.value.toLowerCase().startsWith(w)).slice(0, 8);
  }, [word.text, owners, tags]);

  useEffect(() => {
    setActive(0);
    setOpen(focused && matches.length > 0);
  }, [matches, focused]);

  useEffect(() => {
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, []);

  const accept = (s: Suggestion) => {
    const rest = value.slice(caret);
    const next = `${value.slice(0, word.start)}${s.value}${rest.startsWith(" ") ? "" : " "}${rest}`;
    setValue(next);
    setOpen(false);
    const pos = word.start + s.value.length + 1;
    requestAnimationFrame(() => {
      input.current?.focus();
      input.current?.setSelectionRange(pos, pos);
      setCaret(pos);
    });
  };

  const track = () => setCaret(input.current?.selectionStart ?? value.length);

  return (
    <div className="searchbox" ref={box}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" strokeLinecap="round" />
      </svg>
      <input
        ref={input}
        className="searchbox-input"
        name={name}
        type="search"
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setCaret(e.target.selectionStart ?? e.target.value.length);
        }}
        onFocus={() => setFocused(true)}
        onClick={track}
        onKeyUp={track}
        onKeyDown={(e) => {
          if (!open || !matches.length) return;
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setActive(
              (i) => (i + (e.key === "ArrowDown" ? 1 : matches.length - 1)) % matches.length,
            );
          } else if (e.key === "Enter" || e.key === "Tab") {
            e.preventDefault();
            accept(matches[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open && matches.length ? (
        <div className="searchbox-list" id={listId} role="listbox">
          {matches.map((s, i) => (
            <button
              key={s.value}
              type="button"
              role="option"
              aria-selected={i === active}
              className={`searchbox-option${i === active ? " is-active" : ""}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => accept(s)}
            >
              <span className="mono">{s.value}</span>
              <span className="searchbox-hint">{s.hint}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
