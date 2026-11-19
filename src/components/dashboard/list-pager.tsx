import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

const pagerButton =
  "border-neutral-300 bg-white text-neutral-600 shadow-none hover:bg-neutral-50 hover:text-neutral-800 dark:border-slate-600 dark:bg-transparent dark:text-neutral-300 dark:hover:bg-slate-800";

function visiblePages(page: number, pageCount: number) {
  const start = Math.max(1, Math.min(page - 2, pageCount - 4));
  const end = Math.min(pageCount, start + 4);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function PagerLink({ href, children }: { href: string | null; children: ReactNode }) {
  if (!href) {
    return (
      <Button type="button" variant="outline" className={pagerButton} disabled>
        {children}
      </Button>
    );
  }
  return (
    <Button asChild variant="outline" className={pagerButton}>
      <Link href={href}>{children}</Link>
    </Button>
  );
}

export function ListPager({
  page,
  pageCount,
  total,
  start,
  end,
  hrefFor,
}: {
  page: number;
  pageCount: number;
  total: number;
  start: number;
  end: number;
  hrefFor: (page: number) => string;
}) {
  if (total <= 0) return null;

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-neutral-500 dark:text-neutral-300">
      <p>
        Showing {start}–{end} of {total}
      </p>
      <div className="flex items-center gap-2">
        <PagerLink href={page > 1 ? hrefFor(page - 1) : null}>
          <ChevronLeft />
          Previous
        </PagerLink>
        {visiblePages(page, pageCount).map((number) => (
          <Button
            key={number}
            asChild
            size="icon"
            variant={number === page ? "default" : "outline"}
            className={number === page ? "size-8 shadow-none" : `size-8 ${pagerButton}`}
          >
            <Link href={hrefFor(number)} aria-current={number === page ? "page" : undefined}>
              {number}
            </Link>
          </Button>
        ))}
        <PagerLink href={page < pageCount ? hrefFor(page + 1) : null}>
          Next
          <ChevronRight />
        </PagerLink>
      </div>
    </div>
  );
}
