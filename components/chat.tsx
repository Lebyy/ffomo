"use client";

import { Pet, type Mood } from "@/components/pet";
import type { PetKind } from "@/lib/pets";

export function Bubble({
  from,
  face = false,
  pet = "owl",
  mood = "look",
  wide = false,
  children,
}: {
  from: "ffomo" | "you";
  face?: boolean;
  pet?: PetKind;
  mood?: Mood;
  wide?: boolean;
  children: React.ReactNode;
}) {
  const you = from === "you";
  return (
    <div
      className={`enter-fade flex shrink-0 items-end gap-2 ${you ? "justify-end" : ""} ${wide ? "w-full" : ""}`}
    >
      {face && !you ? <Pet kind={pet} mood={mood} size={36} /> : null}
      <div
        className={`rounded-2xl px-3.5 py-2.5 text-sm leading-snug ${
          wide ? "min-w-0 flex-1" : "max-w-[85%]"
        } ${
          you
            ? "rounded-br-md bg-primary text-primary-foreground"
            : "rounded-bl-md bg-card text-foreground"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

export function Typing() {
  return (
    <Bubble from="ffomo" face>
      <span className="typing flex h-5 items-center gap-1" role="status">
        <span className="sr-only">Reading the decision.</span>
        <i aria-hidden />
        <i aria-hidden />
        <i aria-hidden />
      </span>
    </Bubble>
  );
}
