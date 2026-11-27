"use client";

import { ChevronDown, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SearchableMultiOption = {
  value: string;
  label: string;
  description?: string;
};

export function SearchableMultiSelect({
  name,
  options,
  placeholder = "Select",
  ariaLabel,
  label,
  className,
  onChange,
}: {
  name: string;
  options: SearchableMultiOption[];
  placeholder?: string;
  ariaLabel?: string;
  label?: string;
  className?: string;
  onChange?: (values: string[]) => void;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const chosen = new Set(selected);
  const query = search.trim().toLowerCase();
  const visible = options.filter((option) => {
    const haystack = `${option.label} ${option.description ?? ""}`.toLowerCase();
    return haystack.includes(query);
  });
  const picked = options.filter((option) => chosen.has(option.value));
  const allSelected = options.length > 0 && selected.length === options.length;

  function commit(next: string[]) {
    setSelected(next);
    onChange?.(next);
  }

  function toggle(value: string) {
    commit(chosen.has(value) ? selected.filter((id) => id !== value) : [...selected, value]);
  }

  function selectAll() {
    commit(options.map((option) => option.value));
  }

  function deselectAll() {
    commit([]);
  }

  function openList() {
    setSearch("");
    setActive(0);
    setOpen(true);
  }

  function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, Math.max(visible.length - 1, 0)));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const option = visible[active];
      if (option) toggle(option.value);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div className={cn("grid gap-2 text-sm font-medium", className)}>
      <div className="flex h-6 items-center justify-between gap-2">
        {label ? <span>{label}</span> : <span />}
        <Button
          type="button"
          variant="outline"
          className="h-6 px-2.5 text-xs"
          onClick={allSelected ? deselectAll : selectAll}
          disabled={options.length === 0}
        >
          {allSelected ? "Deselect all" : "Select all"}
        </Button>
      </div>
      <div className="grid gap-2">
          <div ref={rootRef} className="relative">
            {selected.map((id) => (
              <input key={id} type="hidden" name={name} value={id} />
            ))}
            <button
              type="button"
              aria-label={ariaLabel}
              aria-haspopup="listbox"
              aria-expanded={open}
              aria-controls={listId}
              onClick={() => (open ? setOpen(false) : openList())}
              className="border-input dark:bg-input/30 flex h-8 w-full items-center justify-between gap-2 rounded-md border bg-transparent px-2.5 text-left text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <span className={cn("truncate", selected.length === 0 && "text-neutral-500")}>
                {selected.length === 0 ? placeholder : `${selected.length} selected`}
              </span>
              <ChevronDown className={cn("size-4 shrink-0 opacity-60", open && "rotate-180")} />
            </button>
            {open ? (
              <div className="absolute top-full left-0 z-50 mt-1 w-full min-w-48 rounded-md border border-neutral-200 bg-white p-1 shadow-md dark:border-slate-600 dark:bg-[#273142]">
                <input
                  ref={searchRef}
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setActive(0);
                  }}
                  onKeyDown={onSearchKeyDown}
                  placeholder="Search"
                  aria-label={ariaLabel ? `Search ${ariaLabel}` : "Search"}
                  autoComplete="off"
                  className="border-input focus-visible:border-ring focus-visible:ring-ring/50 mb-1 h-8 w-full rounded-md border bg-transparent px-2.5 text-sm outline-none focus-visible:ring-[3px]"
                />
                {visible.length === 0 ? (
                  <p className="px-2.5 py-2 text-sm text-neutral-500">No matches</p>
                ) : (
                  <ul id={listId} role="listbox" aria-multiselectable="true" className="max-h-60 overflow-y-auto">
                    {visible.map((option, index) => {
                      const checked = chosen.has(option.value);
                      return (
                        <li key={option.value}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={checked}
                            onMouseEnter={() => setActive(index)}
                            onClick={() => toggle(option.value)}
                            className={cn(
                              "flex w-full items-start rounded-sm px-2.5 py-1.5 text-left text-sm",
                              checked && "bg-primary/10",
                              index === active && "bg-neutral-100 dark:bg-slate-600",
                            )}
                          >
                            <span>
                              {option.label}
                              {option.description ? (
                                <span className="block text-neutral-500 dark:text-neutral-300">
                                  {option.description}
                                </span>
                              ) : null}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ) : null}
          </div>
      </div>
      {picked.length > 0 ? (
        <div className="flex flex-wrap gap-2 font-normal">
          {picked.map((option) => (
            <span
              key={option.value}
              className="inline-flex w-fit items-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800"
            >
              {option.label}
              <button
                type="button"
                aria-label={`Remove ${option.label}`}
                onClick={() => toggle(option.value)}
                className="text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-100"
              >
                <X className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
