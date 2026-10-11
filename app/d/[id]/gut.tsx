"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Fit } from "@/components/fit";
import { Pair, Shell } from "@/components/shell";
import { Pet } from "@/components/pet";
import { coinLand, pulseLine, type GutRecord, type Lean } from "@/lib/flow";
import { grabFace, reactionAt, reactionLine, watchLive } from "@/lib/watch";
import { PulseRead } from "./pulse";

type Side = "a" | "b";
type Phase = "spin" | "read" | "pulse";

const BIG = "ledge h-13 w-full rounded-2xl font-pixel text-lg font-semibold";
const QUIET = "ledge ledge-quiet h-13 w-full rounded-2xl text-base";
const COIN = "ffomo-coin";

function lastCoin(): Side | null {
  try {
    const value = sessionStorage.getItem(COIN);
    return value === "a" || value === "b" ? value : null;
  } catch {
    return null;
  }
}

export function GutCheck({
  pathA,
  pathB,
  decision,
  lean,
  said,
  onDone,
}: {
  pathA: string;
  pathB: string;
  decision: string;
  lean: Lean;
  said: string[];
  onDone: (gut: GutRecord) => void;
}) {
  const leanRef = useRef(lean);
  leanRef.current = lean;
  const [turns] = useState(() => 4 + Math.floor(Math.random() * 4));
  const [spinMs] = useState(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    return reduced ? 240 : 1500 + Math.floor(Math.random() * 800);
  });
  const [phase, setPhase] = useState<Phase>("spin");
  const [land, setLand] = useState<Side | null>(null);
  const [line, setLine] = useState("");
  const [still, setStill] = useState<string | undefined>();
  const [pulse, setPulse] = useState<GutRecord["pulse"]>();
  const [extra, setExtra] = useState<"smile" | "pulse">("smile");
  const name = (key: Side) => (key === "a" ? pathA : pathB);
  const saidKey = said.join("\n");

  useEffect(() => {
    let cancel = false;
    let landed = false;
    const timers: number[] = [];
    const started = performance.now();
    const arm = window.setTimeout(() => finish(leanRef.current), 1200);
    if (leanRef.current || saidKey.length === 0) finish(leanRef.current);
    else {
      const lines = saidKey.split("\n").filter(Boolean);
      void fetch("/api/lean", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          decision: decision.slice(0, 1000),
          pathA,
          pathB,
          said: lines,
        }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { path?: string; quote?: string } | null) => {
          if (cancel || (data?.path !== "a" && data?.path !== "b")) return;
          finish({ path: data.path, why: data.quote || "From what you said." });
        })
        .catch(() => {
          if (!cancel) finish(null);
        });
    }

    function finish(next: Lean) {
      if (cancel || landed) return;
      landed = true;
      window.clearTimeout(arm);
      const wait = Math.max(0, spinMs - (performance.now() - started));
      timers.push(
        window.setTimeout(() => {
          if (cancel) return;
          const side = coinLand(next ?? leanRef.current, Math.random(), lastCoin());
          try {
            sessionStorage.setItem(COIN, side);
          } catch {
            /* the next flip can repeat */
          }
          setLand(side);
          const at = performance.now();
          timers.push(
            window.setTimeout(() => {
              if (cancel) return;
              const read = reactionAt(at);
              setLine(reactionLine(read.before, read.after, read.saw, watchLive()));
              setStill(grabFace());
              setPhase("read");
            }, 1700),
          );
        }, wait),
      );
    }

    return () => {
      cancel = true;
      window.clearTimeout(arm);
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [decision, pathA, pathB, saidKey, spinMs]);

  function done(ignored: boolean) {
    if (!land) return;
    const keepStill = !ignored && still && still.length <= 120_000 ? still : undefined;
    onDone({
      path: land,
      line,
      ignored,
      still: keepStill,
      pulse: !ignored ? pulse : undefined,
    });
  }

  const noRead =
    line === "Camera stayed off." ||
    line === "Couldn't see a face." ||
    (phase === "read" && extra === "pulse" && (pulse?.a ?? pulse?.b) == null);
  const title = phase === "read" ? line : land ? name(land) : "The coin";
  const sub =
    phase === "pulse"
      ? "Look at each path. Frames go to the Ffomo server for SmartSpectra, then get dropped."
      : phase === "read"
        ? noRead
          ? "Nothing to keep from that."
          : extra === "pulse"
            ? "A 12-second average from your face. Up can mean excited or nervous. Not medical. Not a decision."
            : `At ${land ? name(land) : ""}. From the mouth after it landed. On this phone. A smile is not a decision.`
        : land
          ? "It landed."
          : "Let it land.";

  let action: ReactNode;
  if (phase === "spin" || phase === "pulse") {
    action = (
      <Button type="button" className={BIG} disabled>
        {phase === "pulse" ? "Reading" : "Flipping"}
      </Button>
    );
  } else if (noRead) {
    action = (
      <Button type="button" className={BIG} onClick={() => done(true)}>
        The card
      </Button>
    );
  } else {
    action = (
      <Pair>
        <Button type="button" variant="outline" className={QUIET} onClick={() => done(true)}>
          Leave it out
        </Button>
        <Button type="button" className={BIG} onClick={() => done(false)}>
          Keep it
        </Button>
      </Pair>
    );
  }

  return (
    <Shell step="Gut check" action={action}>
      <div className="flex shrink-0 items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="font-pixel leading-[1.1] font-semibold text-balance">
            <Fit max={26} min={17} lines={2}>
              {title}
            </Fit>
          </h1>
          <p className="line-clamp-3 text-sm text-pretty text-muted-foreground">{sub}</p>
        </div>
        <Pet kind="frog" mood={land ? "idle" : "look"} size={48} />
      </div>
      {phase === "spin" ? (
        <div className="grid min-h-0 flex-1 place-items-center">
          <div
            className="coin-spin grid size-40 place-items-center rounded-full bg-primary px-4 text-center text-primary-foreground"
            style={{ ["--turns" as string]: String(turns), ["--spin" as string]: `${spinMs}ms` }}
          >
            <Fit max={18} min={12} lines={3} className="font-pixel font-semibold">
              {land ? name(land) : "Ffomo"}
            </Fit>
          </div>
        </div>
      ) : null}
      {phase === "pulse" ? (
        <PulseRead
          pathA={pathA}
          pathB={pathB}
          onDone={(read, problem) => {
            setPulse(read ?? undefined);
            setLine(problem || pulseLine(read ?? undefined, pathA, pathB));
            setExtra("pulse");
            setPhase("read");
          }}
        />
      ) : null}
      {phase === "read" && extra === "smile" && !pulse && !noRead ? (
        <button
          type="button"
          className="shrink-0 text-left text-sm text-muted-foreground"
          onClick={() => {
            setExtra("pulse");
            setPhase("pulse");
          }}
        >
          Pulse too · 35 sec. Frames go to our server, then get dropped.
        </button>
      ) : null}
      {phase === "read" && still && extra === "smile" ? (
        <img
          src={still}
          alt="Your face just after it landed"
          className="enter-fade min-h-0 w-full flex-1 rounded-3xl object-cover"
        />
      ) : null}
      {phase === "read" && !still ? (
        <div className="grid min-h-0 flex-1 place-items-center rounded-3xl bg-card/60">
          <Pet kind="owl" mood={noRead ? "sleep" : "look"} size={64} />
        </div>
      ) : null}
    </Shell>
  );
}
