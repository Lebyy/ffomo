"use client";

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Fit } from "@/components/fit";
import { Pair, Shell } from "@/components/shell";
import { Pet } from "@/components/pet";
import { coinLand, pickPlay, pulseLine, readPlays, rememberPlay, type GutRecord, type Lean, type Ritual } from "@/lib/flow";
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

const SPIN_TITLE: Record<Ritual, string> = {
  cards: "Two cards",
  doors: "Two doors",
  point: "It points",
  pets: "One steps up",
  hold: "Hold",
  scratch: "Scratch it off",
};

const SPIN_SUB: Record<Ritual, string> = {
  cards: "One turns over. Your face stays on this phone.",
  doors: "One opens. Your face stays on this phone.",
  point: "Watch where it stops. Your face stays on this phone.",
  pets: "One steps forward. Your face stays on this phone.",
  hold: "Press and hold. Your face stays on this phone.",
  scratch: "Scratch the card. Your face stays on this phone.",
};

const SPIN_WORD: Record<Ritual, string> = {
  cards: "Turning",
  doors: "Opening",
  point: "Pointing",
  pets: "Waiting",
  hold: "Hold it",
  scratch: "Scratch it",
};

function PlayBoard({
  play,
  phase,
  land,
  name,
  onNudge,
}: {
  play: Ritual;
  phase: "spin" | "watch";
  land: Side | null;
  name: (key: Side) => string;
  onNudge: () => void;
}) {
  const open = phase === "watch" ? land : null;
  if (play === "hold") return <HoldPad open={open} name={name} onNudge={onNudge} />;
  if (play === "scratch") return <ScratchPad open={open} name={name} onNudge={onNudge} />;
  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      {(["a", "b"] as const).map((side) => (
        <PlaySide key={side} play={play} side={side} open={open} name={name(side)} />
      ))}
    </div>
  );
}

function PlaySide({
  play,
  side,
  open,
  name,
}: {
  play: Ritual;
  side: Side;
  open: Side | null;
  name: string;
}) {
  const picked = open === side;
  if (play === "cards") {
    return (
      <div
        className={`deal-card min-h-0 flex-1 ${picked ? "is-open is-landed" : ""}`}
        style={{ height: "auto" }}
      >
        <span className="deal-face" aria-hidden />
        <span className="deal-back">
          <Fit max={16} min={12} lines={3} className="font-pixel">
            {name}
          </Fit>
        </span>
      </div>
    );
  }
  if (play === "doors") {
    return (
      <div className="door-stage relative min-h-0 flex-1 overflow-hidden rounded-2xl bg-card">
        <div className="absolute inset-0 grid place-items-center p-2">
          <Fit max={16} min={12} lines={3} className="font-pixel">
            {name}
          </Fit>
        </div>
        <div className={`door absolute inset-0 rounded-2xl ${picked ? "is-open" : ""}`} />
      </div>
    );
  }
  if (play === "pets") {
    return (
      <div
        className={`pet-step flex min-h-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl bg-card ${
          picked ? "is-picked" : open ? "is-other" : ""
        }`}
      >
        <Pet kind={side === "a" ? "cat" : "duck"} mood={picked ? "hop" : "idle"} size={48} />
        <Fit max={15} min={11} lines={2} className="px-2 text-center font-pixel">
          {name}
        </Fit>
      </div>
    );
  }
  return (
    <div
      className={`relative flex min-h-0 flex-1 items-center rounded-2xl border-2 px-3 ${
        picked ? "border-primary" : "border-border"
      }`}
    >
      {open == null && side === "a" ? (
        <span className="point-wander absolute left-2 size-3 rounded-full bg-primary" />
      ) : null}
      {picked ? <span className="point-move absolute left-2 size-3 rounded-full bg-primary" /> : null}
      <Fit max={16} min={12} lines={2} className="pl-5 font-pixel">
        {name}
      </Fit>
    </div>
  );
}

function HoldPad({
  open,
  name,
  onNudge,
}: {
  open: Side | null;
  name: (key: Side) => string;
  onNudge: () => void;
}) {
  const [holding, setHolding] = useState(false);
  const timer = useRef(0);
  function start() {
    setHolding(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(onNudge, reduced() ? 200 : 900);
  }
  function stop() {
    setHolding(false);
    window.clearTimeout(timer.current);
  }
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <button
      type="button"
      className="relative flex h-full flex-col justify-end overflow-hidden rounded-3xl bg-card text-left"
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
    >
      <span className={`hold-fill absolute inset-y-0 left-0 w-full bg-primary/25 ${holding ? "is-holding" : ""}`} />
      <span className="relative p-3 font-pixel text-lg">
        {open ? name(open) : "Hold"}
      </span>
    </button>
  );
}

function ScratchPad({
  open,
  name,
  onNudge,
}: {
  open: Side | null;
  name: (key: Side) => string;
  onNudge: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const moves = useRef(0);
  const done = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const box = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, box.width);
    canvas.height = Math.max(1, box.height);
    ctx.fillStyle = "#6ea8ff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    for (let y = 8; y < canvas.height; y += 16) {
      for (let x = (y / 16) % 2 ? 8 : 0; x < canvas.width; x += 16) {
        ctx.fillRect(x, y, 8, 8);
      }
    }
  }, []);

  function erase(event: PointerEvent<HTMLCanvasElement>) {
    if (done.current || open) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const box = canvas.getBoundingClientRect();
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(event.clientX - box.left, event.clientY - box.top, 18, 0, Math.PI * 2);
    ctx.fill();
    moves.current += 1;
    if (moves.current < 8) return;
    done.current = true;
    onNudge();
  }

  return (
    <div className="relative h-full overflow-hidden rounded-3xl bg-card">
      <div className="absolute inset-0 grid place-items-center p-3 text-center">
        <Fit max={18} min={13} lines={3} className="font-pixel">
          {open ? name(open) : "Scratch"}
        </Fit>
      </div>
      {open ? null : (
        <canvas
          ref={canvasRef}
          className="scratch absolute inset-0 h-full w-full"
          aria-label="Scratch card"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            erase(event);
          }}
          onPointerMove={(event) => {
            if (event.buttons === 0 && event.pointerType === "mouse") return;
            erase(event);
          }}
        />
      )}
    </div>
  );
}

export function GutCheck({
  id,
  pathA,
  pathB,
  decision,
  lean,
  said,
  onDone,
}: {
  id: string;
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
  const [play] = useState<Ritual>(() => pickPlay(id, readPlays()));
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
  const nudgeRef = useRef<() => void>(() => {});
  const name = (key: Side) => (key === "a" ? pathA : pathB);
  const landedName = land ? name(land) : "";
  const saidKey = said.join("\n");

  useEffect(() => {
    rememberPlay(play);
  }, [play]);

  // Land, then read every frame for the whole window before the verdict.
  // Hold and scratch can land early. The others wait out the motion.
  useEffect(() => {
    let cancel = false;
    let scheduled = false;
    let revealed = false;
    let nudged = false;
    let chosen: Lean = null;
    let waitId = 0;
    let arm = 0;
    const timers: number[] = [];
    const started = performance.now();

    function reveal() {
      if (cancel || revealed) return;
      revealed = true;
      const side = coinLand(chosen ?? leanRef.current, Math.random(), lastCoin());
      try {
        sessionStorage.setItem(COIN, side);
      } catch {
        /* the next landing can repeat */
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
    }

    function landNow(next: Lean) {
      if (cancel || scheduled) return;
      scheduled = true;
      chosen = next;
      window.clearTimeout(arm);
      const wait = nudged ? 0 : Math.max(0, spinMs - (performance.now() - started));
      waitId = window.setTimeout(reveal, wait);
      timers.push(waitId);
    }

    nudgeRef.current = () => {
      if (cancel || revealed) return;
      nudged = true;
      if (!scheduled) {
        landNow(leanRef.current);
        return;
      }
      window.clearTimeout(waitId);
      reveal();
    };

    arm = window.setTimeout(() => landNow(leanRef.current), 1200);

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

  // Show the same session camera beside the play while it lands and reads.
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
      play,
      pulse: !ignored ? pulse : undefined,
    });
  }

  const noRead =
    line === "Camera stayed off." ||
    line === "Couldn't see a face." ||
    (phase === "read" && extra === "pulse" && (pulse?.a ?? pulse?.b) == null);

  const title =
    phase === "read" ? line : phase === "watch" ? landedName : SPIN_TITLE[play];

  function readSub() {
    if (noRead) return "Nothing to keep from that.";
    if (extra === "pulse")
      return "A 12-second average from your face. Up can mean excited or nervous. Not medical. Not a decision.";
    if (line === "You smiled.")
      return `A smile at ${landedName}. Read on this phone. A smile is not a decision.`;
    if (line === "You looked unsure.")
      return `You looked unsure at ${landedName}, not glad, not sorry. Nothing to lock in. Your call.`;
    return `No smile at ${landedName}. Read on this phone. Still your call.`;
  }

  const sub =
    phase === "pulse"
      ? "Look at each path. Frames go to the Ffomo server for SmartSpectra, then get dropped."
      : phase === "read"
        ? readSub()
        : phase === "watch"
          ? "It landed. Keep your face in view while it reads."
          : SPIN_SUB[play];

  let action: ReactNode;
  if (phase === "spin" || phase === "watch" || phase === "pulse") {
    action = (
      <Button type="button" className={BIG} disabled>
        {phase === "spin" ? SPIN_WORD[play] : "Reading"}
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
          <PlayBoard
            play={play}
            phase={phase}
            land={land}
            name={name}
            onNudge={() => nudgeRef.current()}
          />
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
