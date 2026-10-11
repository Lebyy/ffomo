"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { createContext, use } from "react";
import { Account } from "@/components/account";

export const Progress = createContext<number | null>(null);

// The session hands every screen one way back. Outside a session, back is home.
export const Back = createContext<{ label: string; go: () => void } | null>(null);

// Time-sensitive choices skip the rest of the session and go straight to the call.
export const Now = createContext<(() => void) | null>(null);

const BLOCKS = 14;

export function Shell({
  step,
  children,
  action,
  onBack,
}: {
  step?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  onBack?: () => void;
}) {
  const progress = use(Progress);
  const handed = use(Back);
  const now = use(Now);
  const back = onBack ? { label: "Back", go: onBack } : handed;
  const filled = progress == null ? 0 : Math.round(progress * BLOCKS);
  return (
    <div className="mx-auto flex h-dvh w-full max-w-md flex-col overflow-hidden px-5 pt-[env(safe-area-inset-top)]">
      <header
        className="flex shrink-0 flex-col gap-2.5 pt-3 pb-3"
        style={{ viewTransitionName: "ffomo-header" }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {back ? (
              <button
                type="button"
                onClick={back.go}
                aria-label={back.label}
                className="-ml-2 grid size-11 place-items-center rounded-xl text-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95"
              >
                <ChevronLeft aria-hidden className="size-6" />
              </button>
            ) : null}
            <Link
              href="/"
              className="rounded-sm font-pixel text-xl font-bold tracking-wide outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              Ffomo
            </Link>
          </div>
          <div className="flex items-center gap-2">
            {step ? (
              <p className="rounded-md bg-muted px-2 py-0.5 font-pixel text-sm text-muted-foreground">
                {step}
              </p>
            ) : null}
            <Account />
          </div>
        </div>
        {progress != null ? (
          <div className="flex h-2 w-full items-center gap-3">
            <div className="flex h-2 flex-1 gap-1" aria-hidden>
              {Array.from({ length: BLOCKS }, (_, index) => (
                <span
                  key={index}
                  className={`block-step flex-1 rounded-[2px] ${index < filled ? "is-on bg-primary" : "bg-muted"}`}
                  style={{ transitionDelay: `${index * 18}ms` }}
                />
              ))}
            </div>
            {now ? (
              <button
                type="button"
                onClick={now}
                className="-my-4 shrink-0 rounded-lg px-1 py-4 font-pixel text-sm text-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95"
              >
                Decide now
              </button>
            ) : null}
          </div>
        ) : null}
      </header>
      <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
        {children}
      </main>
      {action ? (
        <div
          className="shrink-0 pt-3 pb-[max(0.9rem,env(safe-area-inset-bottom))]"
          style={{ viewTransitionName: "ffomo-action" }}
        >
          {action}
        </div>
      ) : null}
    </div>
  );
}

export function Pair({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-2.5">{children}</div>;
}
