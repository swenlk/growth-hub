import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";

export function Placeholder({
  title,
  empty,
  heading = "page",
  children,
}: {
  title: string;
  empty?: string;
  heading?: "page" | "section";
  children: React.ReactNode;
}) {
  return (
    <section className={heading === "section" ? "mt-6" : undefined}>
      {heading === "page" ? (
        <DashboardBreadcrumb title={title} text={title} />
      ) : (
        <h6 className="mb-4 text-lg font-semibold">{title}</h6>
      )}
      <div className="card space-y-3 text-neutral-600 dark:text-neutral-300">{children}</div>
      {empty ? (
        <div className="card mt-4 border border-dashed border-neutral-300 text-center text-neutral-500 dark:border-slate-600 dark:text-neutral-300">
          {empty}
        </div>
      ) : null}
    </section>
  );
}
