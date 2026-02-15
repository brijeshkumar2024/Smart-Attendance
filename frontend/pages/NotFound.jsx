import { Link } from "react-router-dom";

function NotFound() {
  return (
    <div className="page-shell notfound-layout">
      <span className="ambient-orb teal" />
      <span className="ambient-orb gold" />

      <div className="card notfound-card">
        <p className="notfound-code">404</p>
        <h1 className="page-title">Route Not Found</h1>
        <p className="page-subtitle">
          The page you requested does not exist or was moved.
        </p>
        <Link to="/">
          <button className="btn-primary" type="button">
            Back to Login
          </button>
        </Link>
      </div>
    </div>
  );
}

export default NotFound;
