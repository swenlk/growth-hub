"use client";

import { GripVertical } from "lucide-react";
import { useRef, useState, type ChangeEvent, type Dispatch, type DragEvent, type SetStateAction } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatBytes } from "@/lib/format";

export type PendingPdf = {
  key: string;
  file: File;
};

export type SavedPdf = {
  storedFileName: string;
  originalFileName: string;
  sizeBytes: number;
};

export type PdfStrip = { kind: "saved"; pdf: SavedPdf } | { kind: "pending"; pdf: PendingPdf };

function isAllowedPdf(file: File): boolean {
  const name = file.name.toLowerCase();
  const typeOk = file.type === "" || file.type === "application/pdf" || file.type === "application/octet-stream";
  return name.endsWith(".pdf") && typeOk;
}

function stripKey(strip: PdfStrip): string {
  return strip.kind === "saved" ? strip.pdf.storedFileName : strip.pdf.key;
}

function reorder(items: PdfStrip[], from: number, to: number): PdfStrip[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  if (!moved) return items;
  next.splice(to, 0, moved);
  return next;
}

export function PdfField({
  strips,
  setStrips,
  disabled,
  onPickError,
}: {
  strips: PdfStrip[];
  setStrips: Dispatch<SetStateAction<PdfStrip[]>>;
  disabled: boolean;
  onPickError: (message: string | null) => void;
}) {
  const dragFrom = useRef<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);

  function onPick(event: ChangeEvent<HTMLInputElement>) {
    const selected = [...(event.target.files ?? [])];
    event.target.value = "";
    if (selected.length === 0) return;

    const accepted: PdfStrip[] = [];
    let rejected = false;
    for (const file of selected) {
      if (!isAllowedPdf(file)) {
        rejected = true;
        continue;
      }
      accepted.push({ kind: "pending", pdf: { key: crypto.randomUUID(), file } });
    }

    if (rejected) onPickError("Use a PDF file");
    else onPickError(null);
    if (accepted.length > 0) setStrips((items) => [...items, ...accepted]);
  }

  function onDragStart(event: DragEvent<HTMLLIElement>, index: number) {
    dragFrom.current = index;
    setDragging(index);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
  }

  function onDragOver(event: DragEvent<HTMLLIElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  function onDrop(event: DragEvent<HTMLLIElement>, index: number) {
    event.preventDefault();
    const from = dragFrom.current;
    dragFrom.current = null;
    setDragging(null);
    if (from === null) return;
    setStrips((items) => reorder(items, from, index));
  }

  return (
    <div className="grid content-start gap-2">
      <label className="grid gap-2 text-sm font-medium">
        PDFs
        <Input type="file" multiple accept="application/pdf,.pdf" onChange={onPick} disabled={disabled} />
      </label>
      <p className="text-sm font-normal text-neutral-500 dark:text-neutral-300">PDF. Drag a strip to change the order.</p>
      {strips.length > 0 ? (
        <ul className="space-y-2">
          {strips.map((strip, index) => {
            const name = strip.kind === "saved" ? strip.pdf.originalFileName : strip.pdf.file.name;
            const size = strip.kind === "saved" ? strip.pdf.sizeBytes : strip.pdf.file.size;
            return (
              <li
                key={stripKey(strip)}
                draggable={!disabled}
                onDragStart={(event) => onDragStart(event, index)}
                onDragOver={onDragOver}
                onDrop={(event) => onDrop(event, index)}
                onDragEnd={() => {
                  dragFrom.current = null;
                  setDragging(null);
                }}
                className={`flex items-center gap-2 rounded-md border border-neutral-200 px-3 py-2 text-sm dark:border-slate-600 ${
                  disabled ? "" : "cursor-grab active:cursor-grabbing"
                } ${dragging === index ? "opacity-60" : ""}`}
              >
                <GripVertical className="size-4 shrink-0 text-neutral-400" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{name}</span>
                  <span className="text-neutral-500 dark:text-neutral-300">{formatBytes(size)}</span>
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  draggable={false}
                  disabled={disabled}
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={() => setStrips((items) => items.filter((item) => stripKey(item) !== stripKey(strip)))}
                >
                  Remove
                </Button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-neutral-500 dark:text-neutral-300">No PDFs yet.</p>
      )}
    </div>
  );
}
