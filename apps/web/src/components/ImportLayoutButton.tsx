"use client";

// "Import layout" beside "Download layout" on a design page. The file is checked here with the
// canvas's own reader (`layoutFileProblems`), so a broken one is refused on the spot; one that
// passes is left in this tab's session storage and the canvas opens to apply it, as one undo step
// merged over the current layout. Nothing is saved until the canvas saves, the same as any edit
// there (and a read-only canvas keeps it as a local edit, to clone).
import { useConfirm } from "@/components/ConfirmDialog";
import { Upload } from "@/components/Glyphs";
import {
  LayoutImportError,
  layoutFileProblems,
  pendingLayoutKey,
  readLayoutText,
} from "@/lib/layout-import";

export function ImportLayoutButton({ owner, slug }: { owner: string; slug: string }) {
  const confirm = useConfirm();
  const refuse = (body: string) =>
    void confirm({ title: "Layout not imported", body, confirmLabel: "OK", alert: true });

  const take = async (file: File) => {
    let text: string;
    try {
      text = await file.text();
      const problems = layoutFileProblems(readLayoutText(text));
      if (problems.length) return refuse(`This layout cannot be imported: ${problems.join("; ")}.`);
    } catch (err) {
      if (err instanceof LayoutImportError) return refuse(err.message);
      throw err;
    }
    try {
      sessionStorage.setItem(pendingLayoutKey(owner, slug), text);
    } catch {
      return refuse("This browser would not hold the file for the canvas (session storage).");
    }
    window.location.assign(`/d/${owner}/${slug}/canvas`);
  };

  const pick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (file) void take(file);
    });
    input.click();
  };

  return (
    <button
      type="button"
      className="btn-icon btn-icon-text"
      onClick={pick}
      aria-label="Import layout (JSON): opens the canvas with it merged over this layout"
      title="Import layout (JSON): merged over the current layout on the canvas"
    >
      <Upload />
      <span>Import layout</span>
    </button>
  );
}
