"use client";

import { useEffect, useRef } from "react";

export function AutoSubmitForm({
  action,
  children,
}: {
  action: () => Promise<void>;
  children: React.ReactNode;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    formRef.current?.requestSubmit();
  }, []);

  return (
    <form ref={formRef} action={action} className="mt-6">
      {children}
    </form>
  );
}
