"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Fit } from "@/components/fit";
import { Pair, Shell } from "@/components/shell";
import { Pet } from "@/components/pet";
import { coinLand, pulseLine, type GutRecord, type Lean } from "@/lib/flow";
import { getStream, reactionVerdict, watchLive } from "@/lib/watch";
import { PulseRead } from "./pulse";

type Side = "a" | "b";
type Phase = "spin" | "watch" | "read" | "pulse";

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

function reduced() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
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
  useEffect(() => {
    leanRef.current = lean;
  }, [lean]);
  const [turns] = useState(() => 4 + Math.floor(Math.random() * 4));
  const [spinMs] = useState(() =>
    reduced() ? 300 : 2800 + Math.floor(Math.random() * 700),
  );
  const [watchMs] = useState(() => (reduced() ? 1200 : 12000));
  const [phase, setPhase] = useState<Phase>("spin");
  const [land, setLand] = useState<Side | null>(null);
  const [line, setLine] = useState("");
  const [pulse, setPulse] = useState<GutRecord["pulse"]>();
  const [extra, setExtra] = useState<"smile" | "pulse">("smile");
  const [camOn, setCamOn] = useState(false);
  const camRef = useRef<HTMLVideoElement>(null);
  const name = (key: Side) => (key === "a" ? pathA : pathB);
  const landedName = land ? name(land) : "";
  const saidKey = said.join("\n");

  // Spin, land, then read every frame for the whole window before the verdict.
  useEffect(() => {
    let cancel = false;
    let scheduled = false;
    const timers: number[] = [];
    const started = performance.now();
    const arm = window.setTimeout(() => landNow(leanRef.current), 1200);

    function landNow(next: Lean) {
      if (cancel || scheduled) return;
      scheduled = true;
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
          setPhase("watch");
          const at = performance.now();
          timers.push(
            window.setTimeout(() => {
              if (cancel) return;
              const read = reactionVerdict(at, performance.now(), watchLive());
              setLine(read.line);
              setPhase("read");
            }, watchMs),
          );
        }, wait),
      );
    }

    if (leanRef.current || saidKey.length === 0) landNow(leanRef.current);
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
          if (cancel) return;
          if (data?.path !== "a" && data?.path !== "b") return landNow(null);
          landNow({ path: data.path, why: data.quote || "From what you said." });
        })
        .catch(() => {
          if (!cancel) landNow(null);
        });
    }

    return () => {
      cancel = true;
      window.clearTimeout(arm);
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [decision, pathA, pathB, saidKey, spinMs, watchMs]);

  // Show the same session camera next to the coin while it spins and reads.
  useEffect(() => {
    if (phase !== "spin" && phase !== "watch") return;
    let stop = false;
    const attach = () => {
      const video = camRef.current;
      const stream = getStream();
      if (video && stream) {
        if (video.srcObject !== stream) video.srcObject = stream;
        void video.play().catch(() => {});
        setCamOn(true);
        return true;
      }
      return false;
    };
    if (attach()) return;
    const timer = window.setInterval(() => {
      if (stop || attach()) window.clearInterval(timer);
    }, 150);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [phase]);

  function done(ignored: boolean) {
    if (!land) return;
    onDone({
      path: land,
      line,
      ignored,
      pulse: !ignored ? pulse : undefined,
    });
  }

  const noRead =
    line === "Camera stayed off." ||
    line === "Couldn't see a face." ||
    (phase === "read" && extra === "pulse" && (pulse?.a ?? pulse?.b) == null);

  const title =
    phase === "read" ? line : phase === "watch" ? landedName : "The coin";

  function readSub() {
    if (noRead) return "Nothing to keep from that.";
    if (extra === "pulse")
      return "A 12-second average from your face. Up can mean excited or nervous. Not medical. Not a decision.";
    if (line === "You smiled.")
      return `A smile at ${landedName}, read on this phone from every frame. A smile is not a decision.`;
    if (line === "You looked unsure.")
      return `You looked unsure at ${landedName}, not glad, not sorry. Nothing to lock in. Your call.`;
    return `No smile at ${landedName}, read on this phone from every frame. Still your call.`;
  }

  const sub =
    phase === "pulse"
      ? "Look at each path. Frames go to the Ffomo server for SmartSpectra, then get dropped."
      : phase === "read"
        ? readSub()
        : phase === "watch"
          ? "It landed. Keep your face in view while it reads."
          : "Let it land. Watch the coin.";

  let action: ReactNode;
  if (phase === "spin" || phase === "watch" || phase === "pulse") {
    action = (
      <Button type="button" className={BIG} disabled>
        {phase === "spin" ? "Flipping" : "Reading"}
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
      {phase === "spin" || phase === "watch" ? (
        <div className="grid min-h-0 flex-1 grid-cols-2 gap-3">
          <div className="grid place-items-center">
            {phase === "spin" ? (
              <div
                className="coin-spin grid size-32 place-items-center rounded-full bg-primary px-3 text-center text-primary-foreground"
                style={{
                  ["--turns" as string]: String(turns),
                  ["--spin" as string]: `${spinMs}ms`,
                }}
              >
                <Fit max={16} min={11} lines={3} className="font-pixel font-semibold">
                  Ffomo
                </Fit>
              </div>
            ) : (
              <div className="pop-in grid size-32 place-items-center rounded-full bg-primary px-3 text-center text-primary-foreground">
                <Fit max={16} min={11} lines={3} className="font-pixel font-semibold">
                  {landedName}
                </Fit>
              </div>
            )}
          </div>
          <div className="relative min-h-0 overflow-hidden rounded-3xl bg-muted">
            <video
              ref={camRef}
              playsInline
              muted
              className="h-full w-full object-cover [transform:scaleX(-1)]"
            />
            {camOn ? null : (
              <div className="absolute inset-0 grid place-items-center">
                <Pet kind="owl" mood="look" size={44} />
              </div>
            )}
            {phase === "watch" ? (
              <span className="absolute inset-x-2 bottom-2 block h-1.5 overflow-hidden rounded-full bg-background/70">
                <span
                  className="run-bar block h-full bg-primary"
                  style={{ "--run": `${watchMs}ms` } as React.CSSProperties}
                />
              </span>
            ) : null}
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
      {phase === "read" ? (
        <div className="grid min-h-0 flex-1 place-items-center rounded-3xl bg-card/60">
          <Pet
            kind={noRead ? "owl" : "frog"}
            mood={
              line === "You smiled." ? "cheer" : noRead ? "sleep" : "look"
            }
            size={72}
          />
        </div>
      ) : null}
    </Shell>
  );
}
