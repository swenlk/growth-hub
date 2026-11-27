import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export function FormBackLink({ href }: { href: string }) {
  return (
    <Button variant="outline" size="sm" className="bg-white dark:bg-transparent" asChild>
      <Link href={href}>
        <ArrowLeft className="size-3.5" />
        Back
      </Link>
    </Button>
  );
}
