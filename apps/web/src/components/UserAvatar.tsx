// An account's avatar, or its initial on a plain disc when it has none. Server-safe: no state, so
// a broken image URL shows the browser's own fallback rather than swapping to the initial.
export function UserAvatar({
  user,
  size = 28,
}: {
  user: { username: string; displayName: string | null; avatarUrl: string | null };
  size?: number;
}) {
  if (user.avatarUrl)
    return (
      <img
        src={user.avatarUrl}
        alt=""
        width={size}
        height={size}
        className="avatar"
        style={{ width: size, height: size }}
      />
    );
  const initial = (user.displayName || user.username).trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      className="avatar avatar-fallback"
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.4)) }}
    >
      {initial}
    </span>
  );
}
