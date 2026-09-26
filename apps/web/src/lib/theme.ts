// The theme a server-rendered page draws its pictures in. The browser keeps the choice in
// localStorage (the boot script in app/layout.tsx and ThemeToggle) and mirrors it into this
// cookie so the server can ask for thumbnails in the same theme. Without the cookie (a first
// visit), light; ThemeToggle corrects the thumbnails once the page has booted.
import { cookies } from "next/headers";

export type Theme = "light" | "dark";
export const THEME_COOKIE = "zeema-theme";

export async function pageTheme(): Promise<Theme> {
  return (await cookies()).get(THEME_COOKIE)?.value === "dark" ? "dark" : "light";
}
