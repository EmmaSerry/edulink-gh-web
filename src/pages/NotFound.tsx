import { Link } from "react-router-dom";

export function NotFound() {
  return (
    <div className="text-center py-5">
      <h1 className="display-6">404</h1>
      <p className="text-muted">The page you're looking for doesn't exist.</p>
      <Link to="/" className="btn btn-primary btn-sm">
        Back to Dashboard
      </Link>
    </div>
  );
}
