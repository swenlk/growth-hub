import { formatBytes } from "@/lib/format";

export type ViewablePdf = {
  storedFileName: string;
  originalFileName: string;
  sizeBytes: number;
};

function pdfName(fileName: string): string {
  return fileName.replace(/\.pdf$/i, "");
}

export function CourseDocuments({ courseId, documents }: { courseId: string; documents: ViewablePdf[] }) {
  if (documents.length === 0) return null;

  return (
    <div className="mt-6 space-y-3">
      <h6 className="text-sm font-semibold">Documents</h6>
      <ul className="flex flex-wrap gap-3">
        {documents.map((pdf) => {
          const name = pdfName(pdf.originalFileName);
          return (
            <li key={pdf.storedFileName}>
              <a
                href={`/api/media/${courseId}?pdf=${encodeURIComponent(pdf.storedFileName)}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open ${name} PDF`}
                className="group flex w-36 cursor-pointer flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-red-300 hover:shadow-md dark:border-slate-600 dark:bg-slate-800 dark:hover:border-red-400"
              >
                <span className="flex h-24 items-center justify-center bg-neutral-50 dark:bg-slate-900">
                  <span className="relative flex h-16 w-12 items-end justify-center overflow-hidden rounded-sm bg-white pb-2 shadow-sm ring-1 ring-neutral-200 dark:bg-slate-800 dark:ring-slate-600">
                    <span
                      aria-hidden
                      className="absolute top-0 right-0 border-r-[12px] border-b-[12px] border-r-red-100 border-b-transparent dark:border-r-red-900"
                    />
                    <span aria-hidden className="absolute inset-x-1.5 top-2.5 space-y-1">
                      <span className="block h-0.5 rounded-full bg-neutral-200 dark:bg-slate-600" />
                      <span className="block h-0.5 w-4/5 rounded-full bg-neutral-200 dark:bg-slate-600" />
                      <span className="block h-0.5 rounded-full bg-neutral-200 dark:bg-slate-600" />
                    </span>
                    <span className="rounded bg-red-600 px-1 py-0.5 text-[9px] font-bold leading-none tracking-wide text-white">
                      PDF
                    </span>
                  </span>
                </span>
                <span className="border-t border-neutral-100 px-2.5 py-2 dark:border-slate-700">
                  <span className="block truncate text-xs font-medium text-neutral-800 group-hover:text-red-700 dark:text-neutral-100 dark:group-hover:text-red-300">
                    {name}
                  </span>
                  <span className="block text-[11px] text-neutral-500 dark:text-neutral-400">{formatBytes(pdf.sizeBytes)}</span>
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
