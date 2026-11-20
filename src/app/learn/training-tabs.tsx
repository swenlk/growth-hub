"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { AssignmentStatus } from "@/lib/domain";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { cn } from "@/lib/utils";

type TrainingCard = {
  assignmentId: string;
  title: string;
  status: AssignmentStatus;
  dueLabel: string;
  completedLabel: string;
  percent: number;
  overdue: boolean;
};

const TABS: { id: AssignmentStatus; label: string; href: string; empty: string }[] = [
  { id: "assigned", label: "Not started", href: "/api/learn/not-started", empty: "Nothing to start." },
  { id: "in_progress", label: "In progress", href: "/api/learn/in-progress", empty: "Nothing in progress." },
  { id: "completed", label: "Completed", href: "/api/learn/completed", empty: "No completed courses." },
];

export function TrainingTabs() {
  const [tab, setTab] = useState<AssignmentStatus>("in_progress");
  const [cards, setCards] = useState<TrainingCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const active = TABS.find((item) => item.id === tab) ?? TABS[1];

  useEffect(() => {
    const controller = new AbortController();
    setCards(null);
    setError(null);

    fetch(active.href, { signal: controller.signal })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as { courses?: TrainingCard[]; error?: string } | null;
        if (!response.ok) {
          throw new Error(body?.error || "Could not load training");
        }
        setCards(Array.isArray(body?.courses) ? body.courses : []);
      })
      .catch((reason: unknown) => {
        if (reason instanceof Error && reason.name === "AbortError") return;
        setCards([]);
        setError(reason instanceof Error ? reason.message : "Could not load training");
      });

    return () => controller.abort();
  }, [active.href]);

  return (
    <section className="card !h-auto p-0">
      <div role="tablist" aria-label="Training" className="flex flex-wrap border-b border-neutral-200 px-2 dark:border-slate-600">
        {TABS.map((item) => {
          const selected = item.id === tab;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setTab(item.id)}
              className={cn(
                "cursor-pointer border-b-2 px-4 py-3 text-sm font-medium",
                selected
                  ? "border-primary text-primary"
                  : "border-transparent text-neutral-500 hover:text-neutral-800 dark:text-neutral-300 dark:hover:text-white",
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <div className="p-4">
        {cards === null ? (
          <p className="py-10 text-center text-sm text-neutral-500">Loading…</p>
        ) : error ? (
          <p className="py-10 text-center text-sm text-destructive">{error}</p>
        ) : cards.length === 0 ? (
          <Empty>{active.empty}</Empty>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((card) => (
              <Link
                key={card.assignmentId}
                href={`/learn/assignments/${card.assignmentId}`}
                className="block rounded-lg border border-neutral-200 p-4 transition hover:border-primary/40 hover:bg-primary/5 dark:border-slate-600"
              >
                <h6 className="text-base font-semibold">{card.title}</h6>
                <div className="mt-3">
                  <StatusBadge
                    status={card.status}
                    label={card.status === "in_progress" ? "In progress" : card.status === "completed" ? "Completed" : "Not started"}
                  />
                </div>
                {card.status === "completed" ? (
                  <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-300">Completed {card.completedLabel}</p>
                ) : (
                  <>
                    <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-300">
                      {card.dueLabel ? `Due ${card.dueLabel}` : "No due date"}
                      {card.overdue ? <span className="ml-2 font-medium text-destructive">Overdue</span> : null}
                    </p>
                    <div className="mt-4 h-2 overflow-hidden rounded bg-neutral-200 dark:bg-slate-600" aria-hidden="true">
                      <div className="h-full bg-primary" style={{ width: `${card.percent}%` }} />
                    </div>
                    <p className="mt-2 text-sm text-neutral-500">{card.percent}% watched</p>
                  </>
                )}
                <span className="mt-4 inline-block text-sm font-medium text-primary">
                  {card.status === "completed" ? "Review" : "Watch"}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function Empty({ children }: { children: string }) {
  return (
    <div className="rounded-lg border border-dashed border-neutral-300 px-6 py-10 text-center text-sm text-neutral-500 dark:border-slate-600 dark:text-neutral-300">
      {children}
    </div>
  );
}
