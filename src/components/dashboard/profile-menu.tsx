"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import userImg from "@/public/assets/images/user.png";
import { LogOutIcon } from "lucide-react";
import Image from "next/image";

export function ProfileMenu({ name, roleLabel }: { name?: string | null; roleLabel: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className={cn(
            "rounded-full sm:w-8 sm:h-8 w-7 h-7 bg-gray-200/75 hover:bg-slate-200 focus-visible:ring-0 dark:bg-slate-700 dark:hover:bg-slate-600 border-0 cursor-pointer data-[state=open]:bg-gray-300 data-[state=open]:ring-4 data-[state=open]:ring-slate-300 dark:data-[state=open]:ring-slate-500 dark:data-[state=open]:bg-slate-600",
          )}
        >
          <Image src={userImg} className="rounded-full" width={40} height={40} alt="" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="sm:w-[300px] min-w-[250px] p-4 rounded-2xl shadow-lg"
        side="bottom"
        align="end"
      >
        <div className="py-3 px-4 rounded-lg bg-primary/10 flex items-center justify-between">
          <div>
            <h6 className="text-lg text-neutral-900 dark:text-white font-semibold mb-0">
              {name || "Signed in"}
            </h6>
            <span className="text-sm text-neutral-500 dark:text-neutral-300">{roleLabel}</span>
          </div>
        </div>
        <form action="/api/auth/keycloak-signout" method="post" className="pt-4">
          <Button
            type="submit"
            variant="link"
            className="hover:text-red-600 flex items-center gap-3 py-0.5 text-neutral-900 dark:text-white text-base !px-0.5 cursor-pointer leading-[0] w-full justify-start hover:no-underline h-[25px]"
          >
            <LogOutIcon className="!w-4.5 !h-4.5" />
            Sign out
          </Button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
