export function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`badge rounded-pill ${active ? "text-bg-success" : "text-bg-secondary"}`}>
      {active ? "Active" : "Inactive"}
    </span>
  );
}
