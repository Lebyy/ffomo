"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState } from "react";

const ARROW =
  "grid size-9 place-items-center rounded-xl bg-muted text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-30";

export function Pager<T>({
  items,
  label,
  render,
  className = "min-h-0 flex-1",
}: {
  items: T[];
  label: string;
  render: (item: T, index: number) => React.ReactNode;
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const startX = useRef<number | null>(null);
  const n = items.length;
  const at = Math.min(index, Math.max(n - 1, 0));

  function go(step: 1 | -1) {
    if (n < 2) return;
    setDir(step);
    setIndex((at + step + n) % n);
  }

  if (n === 0) return null;
  return (
    <section
      aria-label={label}
      aria-roledescription="carousel"
      className={`flex flex-col gap-2 ${className}`}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") go(1);
        if (event.key === "ArrowLeft") go(-1);
      }}
    >
      <div
        key={at}
        className={`min-h-0 flex-1 ${dir === 1 ? "slide-next" : "slide-prev"}`}
        style={{ touchAction: "pan-y" }}
        onPointerDown={(event) => {
          startX.current = event.clientX;
        }}
        onPointerUp={(event) => {
          if (startX.current == null) return;
          const dx = event.clientX - startX.current;
          startX.current = null;
          if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
        }}
      >
        {render(items[at], at)}
      </div>
      {n > 1 ? (
        <div className="flex shrink-0 items-center justify-between gap-3">
          <button
            type="button"
            data-slot="button"
            className={ARROW}
            aria-label="Previous"
            onClick={() => go(-1)}
          >
            <ChevronLeft />
          </button>
          <div className="flex items-center gap-3">
            {n <= 8 ? (
              <div className="flex items-center gap-1.5" aria-hidden>
                {items.map((_, i) => (
                  <span
                    key={i}
                    className={`block size-2 rounded-[2px] transition-colors ${i === at ? "bg-primary" : "bg-muted"}`}
                  />
                ))}
              </div>
            ) : null}
            <span
              className="font-pixel text-sm text-muted-foreground tabular-nums"
              aria-live="polite"
            >
              <span className="sr-only">{label}, </span>
              {at + 1}/{n}
            </span>
          </div>
          <button
            type="button"
            data-slot="button"
            className={ARROW}
            aria-label="Next"
            onClick={() => go(1)}
          >
            <ChevronRight />
          </button>
        </div>
      ) : null}
    </section>
  );
}
