"use client";

import { useState } from "react";
import { Bubble } from "@/components/chat";
import { Input } from "@/components/ui/input";
import { settleFork } from "@/lib/settle-map";
import { settle, switchCost } from "@/lib/settle";
import type { SavedDecision } from "@/lib/store";

const CHIP =
  "h-10 rounded-xl border-2 px-3 text-left text-sm font-medium data-[on=true]:border-primary data-[on=true]:bg-primary/15";

const FACT_CHIP =
  "min-h-11 rounded-xl border-2 px-3 py-2 text-left text-sm leading-snug font-medium data-[on=true]:border-primary data-[on=true]:bg-primary/15";

const WORRY = {
  fact: "You're missing a fact.",
  money: "It's the money.",
  door: "The other one is still open.",
  others: "You're looking at other people.",
  later: "You don't know how this will feel later.",
  want: "You don't know which one you want.",
  best: "You want the best one.",
} as const;

const LOUD = {
  loud: "The worry is loud.",
  restless: "The worry is still there.",
  quiet: "The worry is quiet.",
} as const;

function sayNext(next: string, picked: boolean) {
  const known: Record<string, string> = {
    "Check it before you decide.": "Check that fact before you pick.",
    "That fact decides it.": "That fact settles it.",
    "You already have the fact.": "You already have the fact. You can stop looking.",
    "The later posts point there, and leaving is cheap.": "People who left were glad later, and leaving is cheap.",
    "It meets your three.": "This one has the three things you asked for.",
    "Your reaction picked this. The coin is theater.": "Your face went this way. The coin was only a nudge.",
    "The coin is theater. Take it and stop.": "The coin was only a nudge. Take this and stop looking.",
    "Your reaction agrees. Close the other one.": "Your face agrees. Take this and stop looking.",
    "Close the door on the other one.": "Take this and stop looking.",
    "Both meet your three. The coin breaks the tie.": "Both have your three things. The coin just breaks the tie.",
    "Both meet your three.": "Both have the three things you asked for.",
    "There is no best.": picked
      ? "There isn't a best one. You already picked. Stop looking."
      : "There isn't a best one. Pick one and stop looking.",
  };
  return known[next] ?? next.replace("People who posted are a selected sample.", "People who post aren't everyone.");
}

function fadeLine(nums: number[]) {
  return nums.join(", ");
}

export function StakesAsk({
  onAnswer,
}: {
  onAnswer: (size: "small" | "big", undo: "easy" | "hard") => void;
}) {
  const [size, setSize] = useState<"small" | "big" | null>(null);
  const [undo, setUndo] = useState<"easy" | "hard" | null>(null);
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto [scrollbar-width:none]">
      <Bubble from="ffomo" face>
        <p className="font-pixel text-lg leading-tight">How big is this?</p>
        <p className="mt-1 text-muted-foreground">
          Anxiety makes everything feel big. Answer the decision, not the feeling.
        </p>
      </Bubble>
      <div className="grid shrink-0 grid-cols-2 gap-2">
        <button type="button" className={CHIP} data-on={size === "small"} onClick={() => setSize("small")}>
          Small
        </button>
        <button type="button" className={CHIP} data-on={size === "big"} onClick={() => setSize("big")}>
          Big
        </button>
      </div>
      <Bubble from="ffomo">
        <p className="font-medium">How hard is it to undo?</p>
      </Bubble>
      <div className="grid shrink-0 grid-cols-2 gap-2">
        <button type="button" className={CHIP} data-on={undo === "easy"} onClick={() => setUndo("easy")}>
          Easy
        </button>
        <button type="button" className={CHIP} data-on={undo === "hard"} onClick={() => setUndo("hard")}>
          Hard
        </button>
      </div>
      <button
        type="button"
        className="ledge h-13 w-full shrink-0 rounded-2xl bg-primary font-pixel text-lg font-semibold text-primary-foreground disabled:opacity-40"
        disabled={!size || !undo}
        onClick={() => size && undo && onAnswer(size, undo)}
      >
        That's it
      </button>
    </div>
  );
}

export function FactGate({
  pathA,
  pathB,
  saved,
  onPatch,
}: {
  pathA: string;
  pathB: string;
  saved: SavedDecision;
  onPatch: (patch: Partial<SavedDecision>) => void;
}) {
  const binding = saved.binding;
  const resolving = saved.resolving;
  function money(key: "paid" | "recoverable" | "extra", raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) {
      onPatch({ [key]: undefined });
      return;
    }
    const n = Number(trimmed);
    if (Number.isFinite(n)) onPatch({ [key]: n });
  }
  const cost = switchCost({
    paid: saved.paid,
    recoverable: saved.recoverable,
    extra: saved.extra,
  });
  return (
    <div className="flex shrink-0 flex-col gap-3">
      <section className="flex flex-col gap-2 rounded-2xl bg-card p-3.5">
        <p className="font-medium">Does a real limit rule one out?</p>
        <p className="text-sm text-pretty text-muted-foreground">
          A date you would miss, a price you can’t pay, or something it has to have.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className={FACT_CHIP}
            data-on={binding?.on === true && !binding.checked}
            onClick={() => onPatch({ binding: { on: true, checked: false } })}
          >
            Not checked yet
          </button>
          <button
            type="button"
            className={FACT_CHIP}
            data-on={binding?.on === false && binding?.checked === true}
            onClick={() => onPatch({ binding: { on: false, checked: true } })}
          >
            Neither
          </button>
          <button
            type="button"
            className={FACT_CHIP}
            data-on={binding?.survives === "b"}
            onClick={() => onPatch({ binding: { on: true, checked: true, survives: "b" } })}
          >
            {pathA} is out
          </button>
          <button
            type="button"
            className={FACT_CHIP}
            data-on={binding?.survives === "a"}
            onClick={() => onPatch({ binding: { on: true, checked: true, survives: "a" } })}
          >
            {pathB} is out
          </button>
        </div>
      </section>
      <section className="flex flex-col gap-2 rounded-2xl bg-card p-3.5">
        <p className="font-medium">The thing you were afraid of missing.</p>
        <div className="grid grid-cols-1 gap-2">
          <button
            type="button"
            className={FACT_CHIP}
            data-on={resolving?.applies === true && resolving.checked === false}
            onClick={() => onPatch({ resolving: { applies: true, checked: false, inHand: false } })}
          >
            Still unknown
          </button>
          <button
            type="button"
            className={FACT_CHIP}
            data-on={resolving?.checked === true && resolving.inHand === false}
            onClick={() => onPatch({ resolving: { applies: true, checked: true, inHand: false } })}
          >
            I looked. It isn’t there.
          </button>
          <button
            type="button"
            className={FACT_CHIP}
            data-on={resolving?.inHand === true}
            onClick={() => onPatch({ resolving: { applies: true, checked: true, inHand: true } })}
          >
            I already have it
          </button>
        </div>
      </section>
      <section className="flex flex-col gap-2 rounded-2xl bg-card p-3.5">
        <p className="font-medium">What would switching cost?</p>
        <p className="text-sm text-muted-foreground">Optional. Leave it blank if money isn’t the limit.</p>
        <div className="grid grid-cols-3 gap-2">
          <Input
            inputMode="decimal"
            aria-label="Already paid"
            placeholder="Paid"
            defaultValue={saved.paid ?? ""}
            className="h-12 rounded-2xl bg-background px-3 text-base"
            onChange={(event) => money("paid", event.target.value)}
          />
          <Input
            inputMode="decimal"
            aria-label="What you could get back"
            placeholder="Back"
            defaultValue={saved.recoverable ?? ""}
            className="h-12 rounded-2xl bg-background px-3 text-base"
            onChange={(event) => money("recoverable", event.target.value)}
          />
          <Input
            inputMode="decimal"
            aria-label="Extra to switch"
            placeholder="Extra"
            defaultValue={saved.extra ?? ""}
            className="h-12 rounded-2xl bg-background px-3 text-base"
            onChange={(event) => money("extra", event.target.value)}
          />
        </div>
        {cost != null ? (
          <p className="text-sm text-muted-foreground">Switching costs {cost}.</p>
        ) : null}
      </section>
    </div>
  );
}

export function factsAnswered(saved: SavedDecision) {
  return Boolean(saved.binding) && Boolean(saved.resolving);
}

export function SettleRead({
  saved,
  pathA,
  pathB,
}: {
  saved: SavedDecision;
  pathA: string;
  pathB: string;
}) {
  const plan = settle(settleFork(saved));
  const name = plan.rec.path === "a" ? pathA : plan.rec.path === "b" ? pathB : "There isn't a best one.";
  const kept = saved.kept === "a" ? pathA : saved.kept === "b" ? pathB : null;
  const posts = (saved.result?.stories ?? []).filter(
    (story) => story.kind !== "sketch" && story.url,
  ).length;
  const worry = kept && plan.cause === "door" ? "The other one is closed." : WORRY[plan.cause];
  return (
    <>
      <Bubble from="ffomo" face wide>
        <p className="font-pixel text-lg leading-tight">{kept ?? name}</p>
        <p className="mt-1 text-pretty">{sayNext(plan.rec.next, Boolean(kept))}</p>
        {kept ? <p className="mt-1">The other one is closed.</p> : null}
        {plan.rec.disagree ? <p className="mt-1 text-regret">Your face went the other way.</p> : null}
        {kept && plan.rec.path && kept !== name ? (
          <p className="mt-1 text-sm text-muted-foreground">We leaned toward {name}. You kept this one.</p>
        ) : null}
      </Bubble>
      <Bubble from="ffomo" wide>
        <p>
          {worry} {LOUD[plan.score.band]}{" "}
          <span className="whitespace-nowrap">{plan.score.alarm} out of 100.</span>
        </p>
        {kept ? (
          <p className="mt-1">From here: {fadeLine(plan.fade.closed)}.</p>
        ) : (
          <>
            <p className="mt-1">Stop looking: {fadeLine(plan.fade.closed)}.</p>
            <p>Keep looking: {fadeLine(plan.fade.open)}.</p>
          </>
        )}
        <p className="mt-1 text-muted-foreground">
          {kept
            ? "Now, a week, a month, six months. Lower is quieter, because the other one is closed. A guess, not a scan."
            : "Now, a week, a month, six months. Lower is quieter. A guess, not a scan. Nothing was made up."}
        </p>
      </Bubble>
      {!kept && posts === 0 && !plan.rec.hold ? (
        <Bubble from="ffomo" wide>
          <p>No one has written about this later. Another search won't invent them.</p>
        </Bubble>
      ) : null}
      {plan.interrupt ? (
        <Bubble from="ffomo" wide>
          <p>Same posts as last time.</p>
        </Bubble>
      ) : null}
      {saved.reasons ? (
        <Bubble from="you">
          <p className="text-pretty">{saved.reasons}</p>
        </Bubble>
      ) : null}
    </>
  );
}
