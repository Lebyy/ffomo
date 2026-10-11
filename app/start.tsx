"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useState, ViewTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Shell } from "@/components/shell";
import { InstallHint } from "@/components/pwa";
import { Fit } from "@/components/fit";
import { Pager } from "@/components/pager";
import { Pet } from "@/components/pet";
import { isLocked, readNow, STEP_LABEL } from "@/lib/flow";
import { PET_KINDS } from "@/lib/pets";
import { shrinkPhoto } from "@/lib/photo";
import { saveDecision, useDecisions, type SavedDecision } from "@/lib/store";

export default function Start() {
  const router = useRouter();
  const [decision, setDecision] = useState("");
  const [when, setWhen] = useState<SavedDecision["when"]>("not-yet");
  const [shot, setShot] = useState("");
  const [error, setError] = useState("");
  const [hop, setHop] = useState({ at: -1, n: 0 });
  const saved = useDecisions();

  function start(voice = false) {
    const text = decision.trim();
    if (!text) {
      setError(voice ? "Say what you're stuck on, then tap Talk." : "Say what you're stuck on.");
      return;
    }
    const id = crypto.randomUUID();
    saveDecision({
      id,
      decision: text,
      when,
      shot: shot || undefined,
      voice: voice || undefined,
    });
    router.push(`/d/${id}`);
  }

  return (
    <ViewTransition enter="rise-in" exit="fade-out" default="none">
      <Shell
        step="Start"
        action={
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Button
              type="submit"
              form="start"
              className="ledge h-13 w-full rounded-2xl font-pixel text-lg font-semibold"
            >
              Start
            </Button>
            <Button
              type="button"
              variant="outline"
              className="ledge ledge-quiet h-13 rounded-2xl px-4 font-pixel text-lg"
              onClick={() => start(true)}
            >
              Talk
            </Button>
          </div>
        }
      >
        <div className="flex shrink-0 items-end justify-between" aria-hidden>
          {PET_KINDS.map((kind, index) => (
            <Pet
              key={`${kind}-${hop.at === index ? hop.n : 0}`}
              kind={kind}
              mood={hop.at === index ? "hop" : decision.trim() ? "look" : "idle"}
              size={40}
              delay={index * 140}
            />
          ))}
        </div>
        <div className="flex shrink-0 flex-col gap-1.5">
          <p className="font-pixel text-sm text-primary">F the FOMO.</p>
          <h1 className="font-pixel text-[2.1rem] leading-[1.05] font-semibold text-balance">
            What are you stuck on?
          </h1>
          <p className="line-clamp-3 text-sm text-pretty text-muted-foreground">
            How it went for people who already chose, and what they wish
            they’d known. Then you decide.
          </p>
          <InstallHint />
        </div>
        <form
          id="start"
          className="flex min-h-0 shrink-0 flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            start();
          }}
        >
          <Field data-invalid={error ? true : undefined}>
            <FieldLabel htmlFor="decision" className="sr-only">
              The decision
            </FieldLabel>
            <Textarea
              id="decision"
              name="decision"
              value={decision}
              placeholder="Keep the job, or take the other offer"
              className="field-sizing-content max-h-21 rounded-2xl px-4 py-3 text-lg [scrollbar-width:none] md:text-lg"
              onChange={(event) => {
                setDecision(event.target.value);
                setError("");
                setHop((last) => ({
                  at: Math.floor(Math.random() * PET_KINDS.length),
                  n: last.n + 1,
                }));
              }}
              aria-invalid={error ? true : undefined}
            />
            {error ? (
              <FieldError className="enter-fade">{error}</FieldError>
            ) : null}
          </Field>
          <Field>
            <div className="flex items-center gap-2">
              {shot ? (
                <img
                  src={shot}
                  alt=""
                  className="size-11 shrink-0 rounded-xl object-cover"
                />
              ) : null}
              <label
                data-slot="button"
                className="ledge ledge-quiet flex h-11 min-w-0 flex-1 cursor-pointer items-center justify-center rounded-xl border border-border bg-card text-sm font-medium focus-within:ring-3 focus-within:ring-ring/50"
              >
                {shot ? "Change photo" : "Add a photo of it, if you have one"}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    void shrinkPhoto(file)
                      .then(setShot)
                      .catch(() => setError("Use a jpeg."));
                  }}
                />
              </label>
              {shot ? (
                <button
                  type="button"
                  className="ledge ledge-quiet h-11 shrink-0 rounded-xl px-3 text-sm"
                  onClick={() => setShot("")}
                >
                  Clear
                </button>
              ) : null}
            </div>
          </Field>
          <Field>
            <ToggleGroup
              aria-label="Have you already chosen?"
              value={[when]}
              spacing={2}
              className="grid w-full grid-cols-2"
              onValueChange={(next) => {
                const picked = next[0];
                if (picked === "not-yet" || picked === "already") {
                  startTransition(() => setWhen(picked));
                }
              }}
            >
              <Choice value="not-yet" when={when}>
                Haven’t chosen
              </Choice>
              <Choice value="already" when={when}>
                Already chose
              </Choice>
            </ToggleGroup>
          </Field>
        </form>
        {saved.length > 0 ? (
          <Pager
            items={saved}
            label="Your decisions"
            className="mt-auto shrink-0"
            render={(item) => (
              <Link
                href={`/d/${item.id}`}
                className="glass flex items-center gap-3 rounded-2xl px-4 py-2.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <Fit max={16} min={12} className="font-semibold">
                    {item.decision}
                  </Fit>
                  <span className="truncate text-sm text-muted-foreground">
                    {statusOf(item)}
                  </span>
                </span>
                <span aria-hidden className="font-pixel text-xl text-primary">
                  ›
                </span>
              </Link>
            )}
          />
        ) : null}
      </Shell>
    </ViewTransition>
  );
}

function statusOf(item: SavedDecision) {
  if (isLocked(item.lockUntil, readNow())) return "Door closed";
  if (!item.result) return item.asked ? "Looking" : "Questions";
  if (item.kept && item.result) {
    return `Keeping: ${item.kept === "a" ? item.result.pathA : item.result.pathB}`;
  }
  return STEP_LABEL[item.step ?? "sides"];
}

function Choice({
  value,
  when,
  children,
}: {
  value: SavedDecision["when"];
  when: SavedDecision["when"];
  children: React.ReactNode;
}) {
  return (
    <ToggleGroupItem
      value={value}
      className="relative h-12 w-full rounded-xl text-base font-medium aria-pressed:bg-transparent data-[state=on]:bg-transparent"
    >
      {when === value ? (
        <ViewTransition name="choice-pill" share="choice-pill" default="none">
          <span aria-hidden className="glass absolute inset-0 rounded-xl" />
        </ViewTransition>
      ) : null}
      <span className="relative">{children}</span>
    </ToggleGroupItem>
  );
}
