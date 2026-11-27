import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-100 p-6 dark:bg-[#1e2734]">
      <div className="card w-full max-w-md text-center">
        <h4 className="text-2xl font-semibold">Page not found</h4>
        <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-300">
          That address is not part of the training app.
        </p>
        <Button asChild className="mt-6">
          <Link href="/">Back home</Link>
        </Button>
      </div>
    </div>
  );
}
