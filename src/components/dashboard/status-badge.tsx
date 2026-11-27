function shownStatus(status: string, label?: string) {
  if (label) return label;
  return status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const TONE: Record<string, string> = {
  active: "border-green-600 bg-green-600/15 text-green-700 dark:text-green-400",
  completed: "border-green-600 bg-green-600/15 text-green-700 dark:text-green-400",
  in_progress: "border-primary bg-primary/10 text-primary",
  assigned: "border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-300",
  disabled: "border-neutral-300 bg-neutral-500/10 text-neutral-600 dark:border-neutral-500 dark:text-neutral-300",
  archived: "border-neutral-300 bg-neutral-500/10 text-neutral-600 dark:border-neutral-500 dark:text-neutral-300",
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const tone = TONE[status] ?? "border-neutral-300 bg-neutral-500/10 text-neutral-600 dark:text-neutral-300";

  return (
    <span className={`inline-flex rounded border px-2.5 py-1 text-xs font-medium ${tone}`}>
      {shownStatus(status, label)}
    </span>
  );
}

export function OverdueNote() {
  return (
    <span className="inline-flex rounded border border-destructive/30 bg-destructive/10 px-1.5 py-0.5 text-xs font-medium text-destructive">
      Overdue
    </span>
  );
}

export function WatchedMeter({ percent }: { percent: number }) {
  const width = Math.min(100, Math.max(0, percent));

  return (
    <span className="inline-flex min-w-24 items-center gap-2">
      <span className="h-1.5 w-14 overflow-hidden rounded bg-neutral-200 dark:bg-slate-600" aria-hidden="true">
        <span className="block h-full bg-primary" style={{ width: `${width}%` }} />
      </span>
      <span>{width}%</span>
    </span>
  );
}
