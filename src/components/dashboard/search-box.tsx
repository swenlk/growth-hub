"use client";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";
import Link from "next/link";

export function DashboardSearch({ items }: { items: { title: string; url: string }[] }) {
  return (
    <Dialog>
      <DialogTrigger>
        <div className="relative sm:max-w-[320px] w-full cursor-pointer">
          <Input
            className={cn(
              "bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 shadow-none focus-visible:ring-0 focus-visible:border-primary border border-slate-300 h-8 pe-5 ps-9 w-full cursor-pointer disabled:opacity-[1] dark:border-slate-600 sm:block hidden",
            )}
            placeholder="Search..."
            disabled
          />
          <span className="sm:absolute sm:top-[50%] sm:start-0 sm:ms-4 sm:-translate-y-[50%]">
            <Search className="text-neutral-500 dark:text-white" width={14} height={14} />
          </span>
        </div>
      </DialogTrigger>
      <DialogContent className={cn("p-0 !max-w-[620px] overflow-hidden")}>
        <DialogTitle className="sr-only">Search</DialogTitle>
        <DialogDescription className="sr-only">Search pages in this workspace.</DialogDescription>
        <Command>
          <CommandInput placeholder="Type a page name..." />
          <CommandList className="scrollbar-thin scrollbar-invisible hover:scrollbar-visible max-h-[400px]">
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Pages" className="mt-2">
              {items.map((item) => (
                <CommandItem key={item.url} className="p-0">
                  <Link href={item.url} className="py-2 px-3 w-full">
                    {item.title}
                  </Link>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
