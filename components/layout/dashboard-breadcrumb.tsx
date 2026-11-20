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
    title: string,
    text: string,
    backHref?: string,
}

const DashboardBreadcrumb = ({ title, text, backHref }: BreadcrumbData) => {
    return (
        <div className='mb-4 flex flex-wrap items-start justify-between gap-2'>
            <h6 className="text-xl font-semibold">{title}</h6>
            <div className="flex flex-col items-end gap-2">
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