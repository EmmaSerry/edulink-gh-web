import { useMemo, useState, type ReactNode } from "react";
import { EmptyState } from "./EmptyState";
import { LoadingSpinner } from "./LoadingSpinner";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  /** Value used for sorting when this column's header is clicked. */
  sortValue?: (row: T) => string | number;
  className?: string;
}

export interface DataTableSelection<T> {
  isSelected: (row: T) => boolean;
  onToggle: (row: T) => void;
  onToggleAllOnPage: (rows: T[], checked: boolean) => void;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[] | undefined;
  getRowKey: (row: T) => string | number;
  /** Which raw string fields free-text search matches against. */
  searchValue?: (row: T) => string;
  searchPlaceholder?: string;
  rowActions?: (row: T) => ReactNode;
  emptyTitle?: string;
  emptyMessage?: string;
  pageSize?: number;
  /** Optional bulk-selection checkboxes (header selects the current page). */
  selection?: DataTableSelection<T>;
}

/**
 * Generic, reusable data table: search + column sorting + pagination +
 * loading/empty states. Every configuration module (School, Academic
 * Years, Terms, Levels, Classes, Subjects, Learning Areas, Skills, Grade
 * Bands, Remarks Bank) renders through this component instead of
 * hand-rolling its own table markup, per the "avoid duplicated code"
 * coding standard.
 */
export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  searchValue,
  searchPlaceholder = "Search…",
  rowActions,
  emptyTitle = "No records yet",
  emptyMessage = "Add your first record using the button above.",
  pageSize = 10,
  selection,
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (!rows) return [];
    if (!search.trim() || !searchValue) return rows;
    const q = search.trim().toLowerCase();
    return rows.filter((r) => searchValue(r).toLowerCase().includes(q));
  }, [rows, search, searchValue]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return filtered;
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return copy;
  }, [filtered, sortKey, sortDir, columns]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const toggleSort = (col: DataTableColumn<T>) => {
    if (!col.sortValue) return;
    if (sortKey === col.key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(col.key);
      setSortDir("asc");
    }
  };

  if (rows === undefined) return <LoadingSpinner />;

  return (
    <div>
      {searchValue && (
        <div className="mb-3">
          <input
            type="search"
            className="form-control"
            style={{ maxWidth: 320 }}
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
      )}

      {sorted.length === 0 ? (
        <EmptyState icon="bi-inbox" title={emptyTitle} message={emptyMessage} />
      ) : (
        <>
          <div className="table-responsive">
            <table className="table align-middle">
              <thead>
                <tr>
                  {selection && (
                    <th style={{ width: 36 }}>
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={pageRows.length > 0 && pageRows.every((r) => selection.isSelected(r))}
                        onChange={(e) => selection.onToggleAllOnPage(pageRows, e.target.checked)}
                      />
                    </th>
                  )}
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      role={col.sortValue ? "button" : undefined}
                      onClick={() => toggleSort(col)}
                      className={`text-muted small text-uppercase ${col.className ?? ""}`}
                      style={{ cursor: col.sortValue ? "pointer" : undefined, whiteSpace: "nowrap" }}
                    >
                      {col.header}
                      {sortKey === col.key && (
                        <i className={`bi ms-1 ${sortDir === "asc" ? "bi-caret-up-fill" : "bi-caret-down-fill"}`} />
                      )}
                    </th>
                  ))}
                  {rowActions && <th className="text-end">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => (
                  <tr key={getRowKey(row)}>
                    {selection && (
                      <td style={{ width: 36 }}>
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked={selection.isSelected(row)}
                          onChange={() => selection.onToggle(row)}
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td key={col.key} className={col.className}>
                        {col.render(row)}
                      </td>
                    ))}
                    {rowActions && <td className="text-end">{rowActions(row)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="d-flex justify-content-between align-items-center mt-2">
              <span className="text-muted small">
                Page {currentPage} of {totalPages} ({sorted.length} records)
              </span>
              <div className="btn-group btn-group-sm">
                <button
                  className="btn btn-outline-secondary"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </button>
                <button
                  className="btn btn-outline-secondary"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
