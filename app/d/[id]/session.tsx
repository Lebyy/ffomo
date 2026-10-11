"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Back, Now, Progress, Shell } from "@/components/shell";
import {
  FEARS,
  knownLean,
  nextLabel,
  nextStep,
  prevStep,
  progressOf,
  stepsFor,
  type ForkInfo,
  type Lean,
  type Step,
} from "@/lib/flow";
import { factsAnswered, FactGate, StakesAsk } from "@/components/settle-view";
import { settleFork, thinResult } from "@/lib/settle-map";
import { switchCost } from "@/lib/settle";
import type { DecideResult, Story } from "@/lib/schema";
import { readDecision, saveDecision, type SavedDecision } from "@/lib/store";
import { AskScreen } from "./ask";
import {
  CardScreen,
  CostScreen,
  FactsScreen,
  FutureScreen,
  MustScreen,
  NO_LIVE,
  ReasonsScreen,
  SearchingScreen,
  SidesScreen,
  Title,
  TryScreen,
  type LiveSearch,
} from "./screens";
import { FaceWatch } from "@/components/face-watch";
import { VoiceBar } from "./voice";

const GutCheck = dynamic(() => import("./gut").then((mod) => mod.GutCheck), {
  ssr: false,
  loading: () => (
    <Shell step="Gut check">
      <p className="font-pixel text-lg text-muted-foreground">One second.</p>
    </Shell>
  ),
});

function reopenNote(saved: SavedDecision) {
  const cost = switchCost(settleFork(saved).numbers);
  if (cost != null && cost > 0)
    return `Opening it makes the worry louder. Switching costs ${cost}.`;
  return "Opening it makes the worry louder.";
}

function clip(text: string, max: number) {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

function fearWords(saved: SavedDecision) {
  if (saved.fearNote) return saved.fearNote;
  if (saved.fearLine) return saved.fearLine;
  return FEARS.find((item) => item.id === saved.fear)?.label ?? "";
}

function saidOf(saved: SavedDecision) {
  const fear = fearWords(saved);
  return [
    ...(saved.answers ?? []).map((item) => `${item.q} ${item.a}`),
    fear ? `Afraid of missing: ${fear}` : "",
    ...(saved.musts ?? []).map((item) => `Must have: ${item}`),
    saved.enough ?? "",
    saved.reasons ?? "",
  ]
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 12)
    .map((line) => clip(line, 400));
}

function searchBody(saved: SavedDecision) {
  const context = (saved.answers ?? [])
    .slice(-4)
    .map((item) => `${clip(item.q, 40)} ${clip(item.a, 80)}`);
  const fear = fearWords(saved);
  if (fear) context.push(`Afraid of missing: ${fear}`);
  return {
    decision: clip(saved.decision, 240),
    when: saved.when,
    paths: saved.fork
      ? { a: saved.fork.pathA, b: saved.fork.pathB }
      : undefined,
    context: context.length > 0 ? context : undefined,
    size: saved.size,
    look: Date.now(),
    image: saved.shot,
  };
}

type LiveEvent =
  | { type: "progress"; kind: "query"; text: string }
  | { type: "progress"; kind: "posts"; n: number }
  | { type: "progress"; kind: "retry" }
  | { type: "checking" }
  | { type: "story"; key?: string; story: Story & { opening?: boolean } }
  | { type: "drop"; key: string }
  | { type: "done"; result: DecideResult }
  | { type: "error"; error: string };

async function readStream(
  res: Response,
  onLive: (event: LiveEvent) => void,
  signal: AbortSignal,
) {
  if (!res.body) throw new Error("Could not read that search.");
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let result: DecideResult | null = null;
  while (!signal.aborted) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line) as LiveEvent;
      onLive(event);
      if (event.type === "done") result = event.result;
      if (event.type === "error") throw new Error(event.error);
    }
  }
  if (!result) throw new Error("The search stopped.");
  return result;
}

const looking = new Map<string, AbortController>();

async function fetchDecision(
  saved: SavedDecision,
  onLive: (event: LiveEvent) => void,
) {
  looking.get(saved.id)?.abort();
  const ac = new AbortController();
  looking.set(saved.id, ac);
  try {
    const res = await fetch("/api/decide", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(searchBody(saved)),
      signal: ac.signal,
    });
    if (!res.ok && res.headers.get("content-type")?.includes("json")) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? "Could not read that search.");
    }
    const result = await readStream(res, onLive, ac.signal);
    const current = readDecision(saved.id) ?? saved;
    saveDecision({ ...current, result });
    return result;
  } finally {
    if (looking.get(saved.id) === ac) looking.delete(saved.id);
  }
}

function dropEmpty(patch: Partial<SavedDecision>, next: SavedDecision) {
  for (const key of Object.keys(patch) as (keyof SavedDecision)[]) {
    if (patch[key] === undefined) delete next[key];
  }
}

function infoOf(saved: SavedDecision): ForkInfo {
  return {
    decision: saved.decision,
    when: saved.when,
    fear: saved.fear,
    size: saved.size,
    undo: saved.undo,
    thing: saved.thing,
    photo: Boolean(saved.shot),
    facts: saved.result?.facts?.length ?? 0,
    records: saved.result?.stories.filter((story) => story.kind !== "sketch").length ?? 0,
  };
}

export function Session({ id }: { id: string }) {
  const router = useRouter();
  const [saved, setSaved] = useState<SavedDecision | null>(() =>
    readDecision(id),
  );
  const [error, setError] = useState("");
  const [pending, setPending] = useState(() => {
    const current = readDecision(id);
    return Boolean(current && !current.result && current.asked);
  });
  const [afterReasons, setAfterReasons] = useState<"card" | "home">("card");
  const [live, setLive] = useState<LiveSearch>(NO_LIVE);
  const [wordLean, setWordLean] = useState<Lean>(null);
  const liveRef = useRef(NO_LIVE);

  function bumpLive(next: LiveSearch) {
    liveRef.current = next;
    setLive(next);
  }

  function onEvent(event: LiveEvent) {
    const cur = liveRef.current;
    if (event.type === "progress") {
      if (event.kind === "query")
        bumpLive({ ...cur, queries: [...cur.queries.slice(-2), event.text] });
      if (event.kind === "posts") bumpLive({ ...cur, posts: event.n });
      if (event.kind === "retry") bumpLive({ ...cur, retries: cur.retries + 1 });
    }
    if (event.type === "checking") bumpLive({ ...cur, checking: true });
    if (event.type === "story") {
      const key = event.key || event.story.url || event.story.text;
      const stories = cur.stories.filter((story) => story.key !== key);
      bumpLive({ ...cur, stories: [...stories, { ...event.story, key }] });
    }
    if (event.type === "drop")
      bumpLive({ ...cur, stories: cur.stories.filter((story) => story.key !== event.key) });
  }

  function commit(patch: Partial<SavedDecision>) {
    setSaved((current) => {
      if (!current) return current;
      const next = { ...current, ...patch };
      dropEmpty(patch, next);
      saveDecision(next);
      return next;
    });
  }

  function forward(extra: Partial<SavedDecision> = {}) {
    setSaved((current) => {
      if (!current) return current;
      const merged = { ...current, ...extra };
      dropEmpty(extra, merged);
      const to = nextStep(current.step ?? stepsFor(infoOf(merged))[0], infoOf(merged));
      if (!to) return current;
      const next = {
        ...merged,
        step: to,
        opens: to === "sides" ? (merged.opens ?? 0) + 1 : merged.opens,
      };
      saveDecision(next);
      return next;
    });
  }

  async function look(current: SavedDecision) {
    if (current.result && (current.refreshes ?? 0) >= 2) return;
    setPending(true);
    setError("");
    bumpLive(NO_LIVE);
    try {
      const result = await fetchDecision(current, onEvent);
      const next = { ...(readDecision(current.id) ?? current), result };
      const first = next.step ?? stepsFor(infoOf(next))[0];
      if (first === "sides" && (next.opens ?? 0) === 0) next.opens = 1;
      saveDecision(next);
      setSaved(next);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError(
        err instanceof Error ? err.message : "Could not read that search.",
      );
    } finally {
      setPending(false);
    }
  }

  function cancelLook() {
    looking.get(id)?.abort();
    setPending(false);
    if (readDecision(id)?.result) return;
    commit({ asked: undefined });
  }

  useEffect(() => {
    const current = readDecision(id);
    if (!current || current.result || !current.asked) return;
    const later = queueMicrotask(() => void look(current));
    return () => {
      void later;
      looking.get(id)?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const step = saved?.step;
    if (step === "card" || step === "reasons" || step === "lock" || step === "checks") return;
    void import("@/lib/feel").then((mod) => void mod.loadFeel());
  }, [saved?.step]);

  useEffect(() => {
    const step = saved?.step;
    if (step === "sides" || step === "must" || step === "future" || step === "tryon") {
      void import("@/lib/gut").then((mod) => void mod.loadFace());
    }
  }, [saved?.step]);

  const saidKey = saved ? saidOf(saved).join("\n") : "";
  const leanPaths = saved?.result ? `${saved.result.pathA}\n${saved.result.pathB}` : "";
  useEffect(() => {
    const [pathA, pathB] = leanPaths.split("\n");
    if (!saved || !pathA || !pathB || !saidKey || knownLean({ when: saved.when, enoughPath: saved.enoughPath }))
      return;
    const decision = clip(saved.decision, 1000);
    let cancel = false;
    void fetch("/api/lean", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision, pathA, pathB, said: saidKey.split("\n") }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { path?: string; quote?: string } | null) => {
        if (cancel || (data?.path !== "a" && data?.path !== "b")) return;
        setWordLean({ path: data.path, why: data.quote || "From what you said." });
      })
      .catch(() => {});
    return () => {
      cancel = true;
    };
    // saved.when and enoughPath are read with saidKey; the decision text is the rest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leanPaths, saidKey, saved?.when, saved?.enoughPath, saved?.decision]);

  if (!saved) {
    return (
      <Shell step="Both sides" onBack={() => router.push("/")}>
        <Title pet="duck" mood="sad">
          That decision isn’t saved to this account.
        </Title>
        <Link href="/" className="font-pixel text-lg text-primary">
          Start one
        </Link>
      </Shell>
    );
  }

  const info = infoOf(saved);
  const result = saved.result;
  const askingStakes = !saved.undo && !saved.step;
  const stored = saved.step ?? stepsFor(info)[0];
  const step = stored === "lock" || stored === "checks" ? "card" : stored;
  const screen: Step | "ask" | "searching" | "stakes" = askingStakes
    ? "stakes"
    : pending
      ? "searching"
      : !result
        ? saved.asked
          ? "sides"
          : "ask"
        : step;
  const progress =
    screen === "stakes"
      ? 0.04
      : screen === "ask"
        ? 0.06
        : screen === "searching"
          ? 0.12
          : progressOf(screen, info);
  const label = nextLabel(
    screen === "ask" || screen === "searching" || screen === "stakes" ? "sides" : screen,
    info,
  );

  function reveal() {
    setSaved((current) => {
      if (!current) return current;
      const next = { ...current, refreshes: Math.min(2, (current.refreshes ?? 0) + 1) };
      saveDecision(next);
      return next;
    });
  }

  function take(path: "a" | "b") {
    const current = readDecision(id);
    if ((current?.reasons?.trim().length ?? 0) >= 12) {
      commit({ kept: path, step: "card", closing: undefined, opening: undefined });
      return;
    }
    commit({ step: "reasons", closing: path, opening: undefined });
  }

  function reopen() {
    commit({ step: "reasons", opening: true, closing: undefined });
  }

  function lookAgain() {
    setSaved((current) => {
      if (!current || (current.refreshes ?? 0) >= 2) return current;
      const next = {
        ...current,
        refreshes: Math.min(2, (current.refreshes ?? 0) + 1),
        step: "sides" as const,
      };
      saveDecision(next);
      return next;
    });
  }

  function goBack() {
    if (screen === "stakes" || screen === "ask") {
      router.push("/");
      return;
    }
    if (screen === "searching") {
      cancelLook();
      return;
    }
    if (screen === "reasons") {
      setAfterReasons("card");
      commit({ step: "card", closing: undefined, opening: undefined });
      return;
    }
    if (screen === "card") {
      router.push("/");
      return;
    }
    const from = screen === "sides" ? (saved!.step ?? "sides") : screen;
    const prev = prevStep(from, info);
    if (!prev) {
      router.push("/");
      return;
    }
    commit({ step: prev });
  }

  function body() {
    if (!saved) return null;

    if (screen === "stakes") {
      return (
        <Shell step="How big">
          <StakesAsk
            onAnswer={(size, undo) => commit({ size, undo })}
          />
        </Shell>
      );
    }

    if (screen === "ask") {
      return (
        <AskScreen
          saved={saved}
          onBack={() => router.push("/")}
          onFork={(fork, paired) =>
            commit({
              fork,
              size: saved.undo ? saved.size : fork.size,
              thing: fork.thing || undefined,
              paired: paired ? true : undefined,
            })
          }
          onDone={(answers, fear, fearNote) => {
            const current = readDecision(saved.id) ?? saved;
            const next: SavedDecision = {
              ...current,
              asked: true,
              answers,
              fear,
              fearNote,
            };
            if (!fear) delete next.fear;
            if (!fearNote) delete next.fearNote;
            if (current.size === "small" && current.undo === "easy" && current.fork) {
              next.result = thinResult(current.fork.pathA, current.fork.pathB);
              next.step = "gut";
              saveDecision(next);
              setSaved(next);
              return;
            }
            saveDecision(next);
            setSaved(next);
            void look(next);
          }}
        />
      );
    }

    if (screen === "searching")
      return (
        <SearchingScreen saved={saved} live={live} onCancel={cancelLook} />
      );

    if (screen === "gut" && result) {
      return (
        <GutCheck
          id={saved.id}
          pathA={result.pathA}
          pathB={result.pathB}
          decision={saved.decision}
          lean={knownLean({ when: saved.when, enoughPath: saved.enoughPath }) ?? wordLean}
          said={saidOf(saved)}
          onDone={(gut) => commit({ gut, step: "card" })}
        />
      );
    }

    if (screen === "facts" && result) {
      return (
        <FactsScreen
          result={result}
          label={label}
          ready={factsAnswered(saved)}
          gate={
            <FactGate
              pathA={result.pathA}
              pathB={result.pathB}
              saved={saved}
              onPatch={commit}
            />
          }
          onNext={() => forward()}
        />
      );
    }

    if (screen === "cost") {
      return (
        <CostScreen
          cost={saved.cost}
          paths={
            saved.when === "not-yet" && saved.result
              ? [saved.result.pathA, saved.result.pathB]
              : undefined
          }
          label={label}
          named={saved.fear === "money" ? fearWords(saved) || "Money" : undefined}
          onNext={(cost) => forward({ cost })}
          onSkip={() => forward({ cost: undefined })}
        />
      );
    }

    if (screen === "must" && result) {
      return (
        <MustScreen
          result={result}
          musts={saved.musts}
          marks={saved.mustMarks}
          enough={saved.enough}
          open={saved.open}
          onSave={(musts) => commit({ musts })}
          onMarks={(mustMarks) => commit({ mustMarks })}
          onClear={() => commit({ enough: undefined, enoughPath: undefined, open: undefined })}
          onEnough={(check) =>
            commit({ enough: check.sentence, enoughPath: check.path, open: check.open })
          }
          onNext={() => forward()}
          label={label}
        />
      );
    }

    if (screen === "future" && result) {
      return (
        <FutureScreen
          result={result}
          shot={saved.shot}
          onShot={(shot) => commit({ shot: shot || undefined })}
          label={label}
          named={saved.fear === "later" ? fearWords(saved) || "How it will feel later" : undefined}
          onNext={() => forward()}
        />
      );
    }

    if (screen === "tryon" && result) {
      return (
        <TryScreen
          result={result}
          shot={saved.shot}
          onShot={(shot) => commit({ shot: shot || undefined })}
          label={label}
          onNext={() => forward()}
        />
      );
    }

    if (screen === "card" && result) {
      return (
        <CardScreen
          saved={saved}
          onPick={take}
          onLook={lookAgain}
          onLeave={() => router.push("/")}
          onCheck={() => commit({ step: "facts" })}
          onReopen={reopen}
          onReasons={() => {
            setAfterReasons("card");
            commit({ step: "reasons", closing: undefined, opening: undefined });
          }}
        />
      );
    }

    if (screen === "reasons") {
      return (
        <ReasonsScreen
          reasons={saved.opening ? "" : saved.reasons}
          intent={saved.opening ? "changed" : saved.closing ? "why" : "edit"}
          note={saved.opening ? reopenNote(saved) : undefined}
          onSave={(reasons) => {
            const text = reasons.trim();
            if (text.length < 12) return;
            const next = afterReasons;
            setAfterReasons("card");
            if (saved.opening) {
              const current = readDecision(id);
              commit({
                kept: undefined,
                challenges: (current?.challenges ?? 0) + 1,
                unlockNote: text,
                step: "card",
                opening: undefined,
                closing: undefined,
              });
              return;
            }
            commit({
              ...(saved.closing ? { kept: saved.closing } : {}),
              reasons: text,
              step: "card",
              closing: undefined,
              opening: undefined,
            });
            if (next === "home") router.push("/");
          }}
        />
      );
    }

    return (
      <SidesScreen
        saved={saved}
        error={error}
        next={saved.kept ? "Your call" : label}
        onLook={() => void look(saved)}
        onReveal={reveal}
        onNext={() => (saved.kept ? commit({ step: "card" }) : forward())}
      />
    );
  }

  const needsFact = stepsFor(info).includes("facts") && !factsAnswered(saved);
  const canSkip =
    Boolean(result) && !needsFact && !["card", "reasons", "facts"].includes(screen);

  return (
    <Back value={{ label: "Back", go: goBack }}>
      <Now value={canSkip ? () => commit({ step: "card" }) : null}>
        <Progress value={progress}>
          {screen === "gut" ? <FaceWatch /> : null}
          {body()}
          {saved.voice ? <VoiceBar saved={saved} screen={screen} live={live} /> : null}
        </Progress>
      </Now>
    </Back>
  );
}
