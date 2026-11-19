export const headCell =
  "px-4 h-12 text-start bg-neutral-100 dark:bg-slate-700 border-t border-neutral-200 first:border-s last:border-e first:rounded-tl-lg last:rounded-tr-lg dark:border-slate-600";

export const bodyCell =
  "py-4 px-4 border-b text-start first:border-s last:border-e border-neutral-200 dark:border-slate-600";

export function lastBodyCell(isLast: boolean) {
  return isLast ? `${bodyCell} first:rounded-bl-lg last:rounded-br-lg` : bodyCell;
}
