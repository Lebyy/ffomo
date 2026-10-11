"use client";

import { useLayoutEffect, useRef } from "react";

const LINES = {
  1: "",
  2: "line-clamp-2",
  3: "line-clamp-3",
  4: "line-clamp-4",
} as const;

// Shrinks its text a pixel at a time until it fits the box it was given.
export function Fit({
  children,
  max,
  min = 11,
  lines = 1,
  className = "",
}: {
  children: React.ReactNode;
  max: number;
  min?: number;
  lines?: keyof typeof LINES;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    let width = -1;
    const fit = () => {
      let size = max;
      node.style.fontSize = `${size}px`;
      while (
        size > min &&
        (node.scrollWidth > node.clientWidth + 1 ||
          node.scrollHeight > node.clientHeight + 1)
      ) {
        size -= 1;
        node.style.fontSize = `${size}px`;
      }
    };
    fit();
    void document.fonts.ready.then(fit);
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.round(entry.contentRect.width);
      if (next === width) return;
      width = next;
      fit();
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [children, max, min]);
  return (
    <span
      ref={ref}
      className={`max-w-full min-w-0 leading-tight ${lines === 1 ? "block truncate" : LINES[lines]} ${className}`}
      style={{ fontSize: max }}
    >
      {children}
    </span>
  );
}
