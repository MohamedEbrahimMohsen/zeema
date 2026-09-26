import Link from "next/link";

export default function NotFound() {
  return (
    <div className="center-stage">
      <div className="center-card">
        <span className="meta mono design-crumb">404</span>
        <h1 className="lead">Not found</h1>
        <p className="small muted">
          There is no design or person at this address, or it is private.
        </p>
        <Link href="/" className="btn btn-primary no-underline">
          Browse designs
        </Link>
      </div>
    </div>
  );
}
