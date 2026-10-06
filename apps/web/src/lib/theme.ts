// The theme a server-rendered page is drawn in. The browser keeps the choice in localStorage
// (the boot script in app/layout.tsx and ThemeToggle) and mirrors it into this cookie, so the
// server can put `data-theme` on <html> itself and ask for thumbnails in the same theme. Without
// the cookie (a first visit), light; the boot script corrects it before first paint.
import { cookies } from "next/headers";

export type Theme = "light" | "dark";
export const THEME_COOKIE = "zeema-theme";

/** Anything but an explicit "dark" is light: the cookie is user-controlled. */
export function themeFrom(value: string | undefined): Theme {
  return value === "dark" ? "dark" : "light";
}

export async function pageTheme(): Promise<Theme> {
  return themeFrom((await cookies()).get(THEME_COOKIE)?.value);
}
