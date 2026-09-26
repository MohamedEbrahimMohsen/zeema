"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// The /notifications page's "Mark all read": posts, then re-renders the page from the server.
export function MarkAllRead({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="pill-btn"
      disabled={disabled || busy}
      onClick={async () => {
        setBusy(true);
        try {
          const res = await fetch("/api/v1/notifications/read", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ all: true }),
          });
          if (res.ok) router.refresh();
        } finally {
          setBusy(false);
        }
      }}
    >
      Mark all read
    </button>
  );
}
