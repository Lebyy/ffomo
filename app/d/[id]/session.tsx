"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Back, Now, Progress, Shell } from "@/components/shell";
import {
  dueCheck,
  FEARS,
  isLocked,
  knownLean,
  nextLabel,
  nextStep,
  type Lean,
  prevStep,
  progressOf,
  readNow,
  stepsFor,
  type ForkInfo,
  type Step,
} from "@/lib/flow";
import type { DecideResult, Story } from "@/lib/schema";
import { readDecision, saveDecision, type SavedDecision } from "@/lib/store";
import { AskScreen } from "./ask";
import {
  CardScreen,
  ChecksScreen,
  CostScreen,
  FactsScreen,
  FutureScreen,
  LockScreen,
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

function clip(text: string, max: number) {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

function saidOf(saved: SavedDecision) {
  const fear = FEARS.find((item) => item.id === saved.fear);
  return [
    ...(saved.answers ?? []).map((item) => `${item.q} ${item.a}`),
    fear ? `Afraid of missing: ${fear.label}` : "",
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
  const fear = FEARS.find((item) => item.id === saved.fear);
  if (fear) context.push(`Afraid of missing: ${fear.label}`);
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
    thing: saved.thing || Boolean(saved.shot),
    photo: Boolean(saved.shot),
    facts: saved.result?.facts?.length ?? 0,
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
  const [passedLock, setPassedLock] = useState(false);
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
      const next = { ...merged, step: to };
      saveDecision(next);
      return next;
    });
  }

  async function look(current: SavedDecision) {
    setPending(true);
    setError("");
    bumpLive(NO_LIVE);
    try {
      const result = await fetchDecision(current, onEvent);
      const next = { ...(readDecision(current.id) ?? current), result };
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
  const now = readNow();
  const due = dueCheck(saved.checks, now);
  const locked = isLocked(saved.lockUntil, now);
  const result = saved.result;
  const screen: Step | "ask" | "searching" = pending
    ? "searching"
    : !result
      ? saved.asked
        ? "sides"
        : "ask"
      : due
        ? "checks"
        : locked && !passedLock
          ? "lock"
          : (saved.step ?? stepsFor(info)[0]);
  const progress =
    screen === "ask"
      ? 0.06
      : screen === "searching"
        ? 0.12
        : progressOf(screen, info);
  const label = nextLabel(
    screen === "ask" || screen === "searching" ? "sides" : screen,
    info,
  );

  function goBack() {
    if (screen === "searching") {
      cancelLook();
      return;
    }
    if (screen === "ask") {
      router.push("/");
      return;
    }
    if (screen === "lock") return;
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

    if (screen === "ask") {
      return (
        <AskScreen
          saved={saved}
          onBack={() => router.push("/")}
          onFork={(fork, paired) =>
            commit({
              fork,
              size: fork.size,
              thing: fork.thing || Boolean(saved.shot) || undefined,
              paired: paired ? true : undefined,
            })
          }
          onDone={(answers, fear) => {
            const next: SavedDecision = {
              ...(readDecision(saved.id) ?? saved),
              asked: true,
              answers,
              fear,
            };
            if (!fear) delete next.fear;
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
      return <FactsScreen result={result} label={label} onNext={() => forward()} />;
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
          enough={saved.enough}
          open={saved.open}
          onSave={(musts) => commit({ musts })}
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
          onCommit={commit}
          onLook={() => {
            if (isLocked(saved.lockUntil, Date.now())) {
              setPassedLock(false);
              return;
            }
            commit({ step: undefined });
            void look({ ...saved, step: undefined });
          }}
          onAlarm={() => setPassedLock(false)}
        />
      );
    }

    if (screen === "reasons") {
      return (
        <ReasonsScreen
          reasons={saved.reasons}
          onSave={(reasons) =>
            commit({ reasons: reasons || undefined, step: "card" })
          }
        />
      );
    }

    if (screen === "checks") {
      const path =
        saved.kept && result
          ? saved.kept === "a"
            ? result.pathA
            : result.pathB
          : undefined;
      return (
        <ChecksScreen
          key={due?.label ?? "list"}
          checks={saved.checks ?? []}
          due={due}
          path={path}
          onSave={(checkLabel, feeling, note, share) => {
            const checks = (saved.checks ?? []).map((item) =>
              item.label === checkLabel
                ? { ...item, feeling, note: note || undefined }
                : item,
            );
            commit({ checks });
            if (share && saved.kept && result) {
              void fetch("/api/record", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  id: saved.id,
                  fork: saved.decision,
                  pathA: result.pathA,
                  pathB: result.pathB,
                  path: saved.kept,
                  when: checkLabel,
                  feeling,
                  words: note || undefined,
                  size: saved.size,
                }),
              }).catch(() => {});
            }
          }}
          onDone={() => commit({ step: "card" })}
        />
      );
    }

    if (screen === "lock") {
      return (
        <LockScreen
          saved={saved}
          onOpen={(note) => {
            setPassedLock(true);
            commit({
              lockUntil: undefined,
              unlockNote: note || undefined,
              step: "card",
            });
          }}
          onRead={() => {
            setPassedLock(true);
            commit({
              step: saved.step && saved.step !== "lock" ? saved.step : "card",
            });
          }}
        />
      );
    }

    return (
      <SidesScreen
        saved={saved}
        error={error}
        next={label}
        onLook={() => {
          if (isLocked(saved.lockUntil, Date.now())) {
            setPassedLock(false);
            return;
          }
          void look(saved);
        }}
        onNext={() => forward()}
      />
    );
  }

  const canSkip = Boolean(result) && !["card", "reasons", "lock", "checks"].includes(screen);

  return (
    <Back value={{ label: "Back", go: goBack }}>
      <Now value={canSkip ? () => commit({ step: "card" }) : null}>
        <Progress value={progress}>
          <FaceWatch />
          {body()}
          {saved.voice ? <VoiceBar saved={saved} screen={screen} live={live} /> : null}
        </Progress>
      </Now>
    </Back>
  );
}
