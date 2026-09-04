import { Link } from "react-router-dom";

export interface BreadcrumbItem {
  label: string;
  path?: string;
}

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="breadcrumb">
      <ol className="breadcrumb small">
        <li className="breadcrumb-item">
          <Link to="/">Dashboard</Link>
        </li>
        {items.map((item, i) => (
          <li
            key={i}
            className={`breadcrumb-item ${i === items.length - 1 ? "active" : ""}`}
            aria-current={i === items.length - 1 ? "page" : undefined}
          >
            {item.path && i !== items.length - 1 ? (
              <Link to={item.path}>{item.label}</Link>
            ) : (
              item.label
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
