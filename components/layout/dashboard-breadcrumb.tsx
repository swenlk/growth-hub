import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { FormBackLink } from "@/components/shared/form-back-link";
import { Fragment } from "react";
import { House } from "lucide-react";

interface BreadcrumbData {
    title?: string;
    /** Sidebar item this page belongs to. */
    text: string;
    /** Last crumb when it differs from the sidebar name and should not be the page heading. */
    page?: string;
    hint?: string;
    backHref?: string;
    nav?: "tenant_admin" | "staff" | "super_admin";
}

type Crumb = { label: string; href?: string };

const linkClass =
    "flex items-center gap-2 font-medium text-sm text-neutral-600 hover:text-primary dark:text-white dark:hover:text-primary";

function homeCrumb(nav: BreadcrumbData["nav"]): Crumb | null {
    if (nav === "staff") return { label: "My training", href: "/learn" };
    if (nav === "super_admin") return null;
    return { label: "Dashboard", href: "/admin" };
}

function sectionHref(text: string, nav: BreadcrumbData["nav"]): string | undefined {
    if (text === "Profile") return nav === "staff" ? "/learn/profile" : "/admin/profile";
    const hrefs: Record<string, string> = {
        Dashboard: "/admin",
        Staff: "/admin/staff",
        Courses: "/admin/courses",
        Assignments: "/admin/assignments",
        Reports: "/admin/reports",
        "My training": "/learn",
        Tenants: "/platform/tenants",
        "Tenant admins": "/platform/tenant-admins",
    };
    return hrefs[text];
}

function trail({ title, text, page, backHref, nav }: BreadcrumbData): Crumb[] {
    const home = homeCrumb(nav);
    const current = page ?? title;
    const pageLabel = current && current !== text ? current : null;
    const sectionIsHome = home?.label === text;

    if (pageLabel) {
        const parent: Crumb[] = [];
        if (home && !sectionIsHome) parent.push(home);
        parent.push({ label: text, href: backHref ?? sectionHref(text, nav) ?? home?.href });
        parent.push({ label: pageLabel });
        return parent;
    }

    if (home && !sectionIsHome) return [home, { label: text }];
    return [{ label: text }];
}

const DashboardBreadcrumb = ({ title, text, page, hint, backHref, nav }: BreadcrumbData) => {
    const crumbs = trail({ title, text, page, backHref, nav });

    return (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
            {title || hint ? (
                <div>
                    {title ? <h6 className="text-xl font-semibold">{title}</h6> : null}
                    {hint ? <p className="mt-1 max-w-xl text-sm font-normal text-neutral-500 dark:text-neutral-300">{hint}</p> : null}
                </div>
            ) : null}
            <div className="ml-auto flex flex-col items-end gap-2">
                <Breadcrumb>
                    <BreadcrumbList>
                        {crumbs.map((crumb, index) => {
                            const last = index === crumbs.length - 1;
                            const label = (
                                <>
                                    {crumb.label === "Dashboard" ? <House size={14} /> : null}
                                    {crumb.label}
                                </>
                            );
                            return (
                                <Fragment key={`${crumb.label}-${index}`}>
                                    {index > 0 ? <BreadcrumbSeparator /> : null}
                                    <BreadcrumbItem className="text-sm">
                                        {last || !crumb.href ? (
                                            <BreadcrumbPage className="inline-flex items-center gap-2 font-medium">{label}</BreadcrumbPage>
                                        ) : (
                                            <BreadcrumbLink href={crumb.href} className={linkClass}>
                                                {label}
                                            </BreadcrumbLink>
                                        )}
                                    </BreadcrumbItem>
                                </Fragment>
                            );
                        })}
                    </BreadcrumbList>
                </Breadcrumb>
                {backHref ? <FormBackLink href={backHref} /> : null}
            </div>
        </div>
    );
};

export default DashboardBreadcrumb;
