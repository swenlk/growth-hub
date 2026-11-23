import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { FormBackLink } from "@/components/shared/form-back-link";
import { House } from 'lucide-react';


interface BreadcrumbData {
    title?: string,
    text: string,
    hint?: string,
    backHref?: string,
}

const DashboardBreadcrumb = ({ title, text, hint, backHref }: BreadcrumbData) => {
    return (
        <div className='mb-4 flex flex-wrap items-start justify-between gap-2'>
            {title || hint ? (
                <div>
                    {title ? <h6 className="text-xl font-semibold">{title}</h6> : null}
                    {hint ? <p className="mt-1 max-w-xl text-sm font-normal text-neutral-500 dark:text-neutral-300">{hint}</p> : null}
                </div>
            ) : null}
            <div className="ml-auto flex flex-col items-end gap-2">
                <Breadcrumb>
                    <BreadcrumbList>
                        <BreadcrumbItem className="">
                            <BreadcrumbLink href='/' className='flex items-center gap-2 font-medium text-sm text-neutral-600 hover:text-primary dark:text-white dark:hover:text-primary'>
                                <House size={14} />
                                Dashboard
                            </BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem className="text-sm">
                            <BreadcrumbPage>{text}</BreadcrumbPage>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>
                {backHref ? <FormBackLink href={backHref} /> : null}
            </div>
        </div>
    );
};

export default DashboardBreadcrumb;