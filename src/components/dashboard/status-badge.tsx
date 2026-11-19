function shownStatus(status: string, label?: string) {
  if (label) return label;
  return status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const active = status === "active" || status === "completed";

  return (
    <span
      className={
        active
          ? "px-3 py-1.5 rounded text-sm font-medium border bg-green-600/15 text-green-600 border-green-600"
          : "px-3 py-1.5 rounded text-sm font-medium border bg-gray-600/15 text-gray-600 dark:text-white border-gray-400"
      }
    >
      {shownStatus(status, label)}
    </span>
  );
}
