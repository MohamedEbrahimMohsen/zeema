import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md space-y-3 py-10 text-center">
      <h1 className="text-2xl font-semibold">Not found</h1>
      <p className="muted text-sm">
        There is no design or person at this address, or it is private.
      </p>
      <Link href="/browse" className="btn no-underline">
        Browse designs
      </Link>
    </div>
  );
}
