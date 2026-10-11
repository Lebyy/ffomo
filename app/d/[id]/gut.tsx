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
  holdMs,
}: {
  play: Ritual;
  phase: "spin" | "watch";
  land: Side | null;
  name: (key: Side) => string;
  holdMs: number;
}) {
  const open = phase === "watch" ? land : null;
  const pace = { "--play": `${holdMs}ms` } as React.CSSProperties;
  if (play === "hold") return <HoldPad open={open} name={name} holdMs={holdMs} />;
  if (play === "scratch") return <ScratchPad open={open} name={name} ms={holdMs} />;
  if (play === "point") {
    return (
      <div className="relative flex h-full min-h-0 flex-col gap-2">
        {(["a", "b"] as const).map((side) => (
          <div
            key={side}
            className={`flex min-h-0 flex-1 items-center rounded-2xl border-2 px-3 ${
              open === side ? "border-primary" : "border-border"
            }`}
          >
            <Fit max={16} min={12} lines={2} className="pl-5 font-pixel">
              {name(side)}
            </Fit>
          </div>
        ))}
        <span
          className={`point-mark absolute left-2 size-3 rounded-full bg-primary ${open ? "is-set" : ""}`}
          data-side={open ?? "move"}
          style={pace}
        />
      </div>
    );
  }
  return (
    <div className="play-stage flex h-full min-h-0 flex-col gap-2">
      {(["a", "b"] as const).map((side) => (
        <PlaySide key={side} play={play} side={side} open={open} name={name(side)} pace={pace} />
      ))}
    </div>
  );
}

function PlaySide({
  play,
  side,
  open,
  name,
  pace,
}: {
  play: Ritual;
  side: Side;
  open: Side | null;
  name: string;
  pace: React.CSSProperties;
}) {
  const picked = open === side;
  const resting = open != null && !picked;
  if (play === "cards") {
    return (
      <div
        className={`deal-card min-h-0 flex-1 ${picked ? "is-open is-landed" : resting ? "is-rest" : "is-live"}`}
        data-side={side}
        style={{ height: "auto", ...pace }}
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
        <div
          className={`door absolute inset-0 rounded-2xl ${picked ? "is-open" : resting ? "is-shut" : "is-live"}`}
          data-side={side}
          style={pace}
        />
      </div>
    );
  }
  if (play === "pets") {
    return (
      <div
        className={`pet-step flex min-h-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl bg-card ${
          picked ? "is-picked" : open ? "is-other" : "is-live"
        }`}
        data-side={side}
        style={pace}
      >
        <Pet kind={side === "a" ? "cat" : "duck"} mood={picked ? "hop" : "idle"} size={48} />
        <Fit max={15} min={11} lines={2} className="px-2 text-center font-pixel">
          {name}
        </Fit>
      </div>
    );
  }
  return null;
}

function HoldPad({
  open,
  name,
  holdMs,
}: {
  open: Side | null;
  name: (key: Side) => string;
  holdMs: number;
}) {
  const [holding, setHolding] = useState(false);
  return (
    <button
      type="button"
      className="relative flex h-full flex-col justify-end overflow-hidden rounded-3xl bg-card text-left"
      onPointerDown={() => setHolding(true)}
      onPointerUp={() => setHolding(false)}
      onPointerLeave={() => setHolding(false)}
      onPointerCancel={() => setHolding(false)}
    >
      <span
        className={`hold-fill absolute inset-y-0 left-0 w-full bg-primary/25 ${holding ? "is-holding" : ""}`}
        style={{ "--hold": `${holdMs}ms` } as React.CSSProperties}
      />
      <span className="relative p-3 font-pixel text-lg">
        {open ? name(open) : "Hold"}
      </span>
    </button>
  );
}

function coat(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#6ea8ff";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  for (let y = 8; y < h; y += 16) {
    for (let x = (y / 16) % 2 ? 8 : 0; x < w; x += 16) ctx.fillRect(x, y, 8, 8);
  }
}

function scratchPath(w: number, h: number) {
  const pts: { x: number; y: number }[] = [];
  const rows = 7;
  for (let i = 0; i < rows; i++) {
    const y = h * (0.08 + (0.84 * i) / (rows - 1));
    const left = w * 0.08;
    const right = w * 0.92;
    if (i % 2 === 0) pts.push({ x: left, y }, { x: right, y });
    else pts.push({ x: right, y }, { x: left, y });
  }
  return pts;
}

function strokeUntil(
  ctx: CanvasRenderingContext2D,
  pts: { x: number; y: number }[],
  t: number,
  width: number,
) {
  if (t <= 0 || pts.length < 2) return;
  let total = 0;
  const seg: number[] = [];
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    seg.push(d);
    total += d;
  }
  let left = total * Math.min(1, t);
  ctx.globalCompositeOperation = "destination-out";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(0,0,0,1)";
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 0; i < seg.length && left > 0; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (left >= seg[i]) {
      ctx.lineTo(b.x, b.y);
      left -= seg[i];
    } else {
      const u = left / seg[i];
      ctx.lineTo(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u);
      left = 0;
    }
  }
  ctx.stroke();
}

function ScratchPad({
  open,
  name,
  ms,
}: {
  open: Side | null;
  name: (key: Side) => string;
  ms: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const finger = useRef<{ x: number; y: number }[]>([]);
  const size = useRef({ w: 1, h: 1 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || open) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const box = canvas.getBoundingClientRect();
    const w = Math.max(1, box.width);
    const h = Math.max(1, box.height);
    canvas.width = w;
    canvas.height = h;
    size.current = { w, h };
    const path = scratchPath(w, h);
    const width = Math.max(22, h * 0.14);
    const start = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      coat(ctx, w, h);
      strokeUntil(ctx, path, t, width);
      ctx.globalCompositeOperation = "destination-out";
      for (const point of finger.current) {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 11, 0, Math.PI * 2);
        ctx.fill();
      }
      if (t < 1) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [open, ms]);

  function erase(event: PointerEvent<HTMLCanvasElement>) {
    if (open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const box = canvas.getBoundingClientRect();
    finger.current.push({
      x: event.clientX - box.left,
      y: event.clientY - box.top,
    });
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
  const [playMs] = useState(() => (reduced() ? 400 : 15000));
  const [watchMs] = useState(() => (reduced() ? 800 : 15000));
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

  useEffect(() => {
    rememberPlay(play);
  }, [play]);

  // The play runs for 15 seconds, then the face is read for 15 seconds.
  // Scratching or holding does not skip either window.
  useEffect(() => {
    let cancel = false;
    let chosen: Lean = null;
    const timers: number[] = [];

    function reveal() {
      if (cancel) return;
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

    timers.push(window.setTimeout(reveal, playMs));

    if (!(leanRef.current || saidKey.length === 0)) {
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
          if (cancel || !data) return;
          if (data.path !== "a" && data.path !== "b") return;
          chosen = { path: data.path, why: data.quote || "From what you said." };
        })
        .catch(() => {});
    }

    return () => {
      cancel = true;
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [decision, pathA, pathB, saidKey, playMs, watchMs]);

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
          ? "It landed. Fifteen seconds on your face. On this phone."
          : `${SPIN_SUB[play]} Fifteen seconds.`;

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
          <div className="relative h-full min-h-0">
            <PlayBoard
              play={play}
              phase={phase}
              land={land}
              name={name}
              holdMs={playMs}
            />
            {phase === "spin" ? (
              <span className="pointer-events-none absolute inset-x-2 bottom-2 block h-1.5 overflow-hidden rounded-full bg-background/70">
                <span
                  key="play"
                  className="run-bar block h-full bg-primary"
                  style={{ "--run": `${playMs}ms` } as React.CSSProperties}
                />
              </span>
            ) : null}
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
              <span className="pointer-events-none absolute inset-x-2 bottom-2 block h-1.5 overflow-hidden rounded-full bg-background/70">
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
