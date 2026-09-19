import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-10">
      <div className="empty-panel">
        <div className="lead">Not found</div>
        <p className="small muted">
          There is no design or person at this address, or it is private.
        </p>
        <Link href="/" className="btn btn-sm no-underline">
          Browse designs
        </Link>
      </div>
    </div>
  );
}
