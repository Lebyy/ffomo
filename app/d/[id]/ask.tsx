"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { Input } from "@/components/ui/input";
import { Fit } from "@/components/fit";
import { Progress, Shell } from "@/components/shell";
import { FEARS, stakesOf, type Fear } from "@/lib/flow";
import type { Fork } from "@/lib/schema";
import type { Answer, SavedDecision } from "@/lib/store";
import { LINK, NextButton, Pick, QuietButton, Title } from "./screens";

const asking = new Map<string, Promise<Fork>>();

function fetchFork(saved: SavedDecision) {
  const existing = asking.get(saved.id);
  if (existing) return existing;
  const pending = fetch("/api/ask", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      decision: saved.decision,
      when: saved.when,
      image: saved.shot,
    }),
  }).then(async (res) => {
    const body = (await res.json().catch(() => ({}))) as Fork & {
      error?: string;
    };
    if (!res.ok) throw new Error(body.error ?? "Could not read that.");
    return body;
  });
  asking.set(saved.id, pending);
  pending.catch(() => asking.delete(saved.id));
  return pending;
}

const FEAR_Q = "What are you afraid of missing?";

type Question = { text: string; choices: string[]; fear?: boolean };

export function AskScreen({
  saved,
  onFork,
  onDone,
  onBack,
}: {
  saved: SavedDecision;
  onFork: (fork: Fork, paired?: boolean) => void;
  onDone: (answers: Answer[], fear?: Fear, fearLine?: string) => void;
  onBack: () => void;
}) {
  const fork = saved.fork;
  const [failed, setFailed] = useState("");
  const [replies, setReplies] = useState<(string | null)[]>([]);
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState("");
  const [pair, setPair] = useState<string[]>([]);
  const paired = Boolean(saved.paired);
  const saveFork = useEffectEvent(onFork);

  useEffect(() => {
    if (saved.fork) return;
    fetchFork(saved)
      .then((next) => saveFork(next))
      .catch((err: unknown) =>
        setFailed(err instanceof Error ? err.message : "Could not read that."),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved.id]);

  const options = fork ? [fork.pathA, fork.pathB, ...(fork.others ?? [])] : [];
  const choosing = options.length > 2 && !paired;
  const ready = (Boolean(fork) && !choosing) || Boolean(failed);

  function toggle(option: string) {
    setPair((current) =>
      current.includes(option)
        ? current.filter((item) => item !== option)
        : current.length < 2
          ? [...current, option]
          : current,
    );
  }

  function comparePair() {
    if (!fork || pair.length !== 2) return;
    onFork(
      {
        ...fork,
        pathA: pair[0],
        pathB: pair[1],
        others: options.filter((item) => !pair.includes(item)),
      },
      true,
    );
  }
  const big =
    stakesOf({ decision: saved.decision, size: fork?.size }) === "big";
  // The model writes fear options in the decision's own words. Fall back to the
  // five generic ones only when it returns nothing.
  const fearOptions =
    fork?.fears && fork.fears.length >= 2 ? fork.fears : FEARS;
  const questions: Question[] = [
    ...(fork?.questions ?? []).map((item) => ({
      text: item.text,
      choices: item.choices,
    })),
    ...(big
      ? [{ text: FEAR_Q, choices: fearOptions.map((item) => item.label), fear: true }]
      : []),
  ];
  const done = ready && index >= questions.length;
  const current = ready && !done ? questions[index] : null;

  function reply(text: string | null) {
    const next = questions.map((_, i) =>
      i === index ? text : (replies[i] ?? null),
    );
    setReplies(next);
    setIndex(index + 1);
    setDraft("");
  }

  function finish() {
    const answers: Answer[] = [];
    let fear: Fear | undefined;
    let fearLine: string | undefined;
    questions.forEach((question, i) => {
      const value = replies[i];
      if (!value) return;
      if (question.fear) {
        const picked = fearOptions.find((item) => item.label === value);
        fear = picked?.id;
        fearLine = picked?.label;
      } else answers.push({ q: question.text, a: value });
    });
    onDone(answers, fear, fearLine);
  }

  const typed = draft.trim();
  let action = (
    <NextButton disabled onClick={() => {}}>
      Reading it
    </NextButton>
  );
  if (choosing)
    action = (
      <NextButton disabled={pair.length !== 2} onClick={comparePair}>
        {pair.length === 2 ? "Compare these two" : `Pick ${2 - pair.length} more`}
      </NextButton>
    );
  else if (done) action = <NextButton onClick={finish}>See both sides</NextButton>;
  else if (current && typed)
    action = <NextButton onClick={() => reply(typed)}>Next</NextButton>;
  else if (current)
    action = <QuietButton onClick={() => reply(null)}>Skip</QuietButton>;

  const answered = replies.slice(0, index).filter(Boolean).length;

  return (
    <Progress
      value={
        0.02 +
        (0.1 * Math.min(index, questions.length)) /
          Math.max(questions.length, 1)
      }
    >
      <Shell
        step="Questions"
        action={action}
        onBack={() => {
          if (index > 0) {
            setIndex(index - 1);
            return;
          }
          if (paired) {
            onFork(fork!, false);
            return;
          }
          onBack();
        }}
      >
        <Title
          sub={saved.when === "already" ? "Already did" : "Not yet"}
          pet="owl"
          mood={done ? "cheer" : ready ? "idle" : "look"}
        >
          {saved.decision}
        </Title>
        {saved.shot ? (
          <img
            src={saved.shot}
            alt=""
            className="h-16 w-16 shrink-0 rounded-2xl object-cover"
          />
        ) : null}

        {choosing ? (
          <section className="enter-fade flex min-h-0 flex-col gap-3">
            <h2 className="text-[1.35rem] leading-tight font-semibold text-balance">
              You named {options.length}. Which two first?
            </h2>
            <p className="text-sm text-muted-foreground">
              Tap two, in the order you think of them. The rest stay on your list.
            </p>
            <div className="grid shrink-0 grid-cols-2 gap-2">
              {options.map((option) => {
                const at = pair.indexOf(option);
                return (
                  <Pick
                    key={option}
                    pressed={at >= 0}
                    onClick={() => toggle(option)}
                    className="min-h-14 px-3 py-2 [&:last-child:nth-child(odd)]:col-span-2"
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-4 shrink-0 font-pixel text-primary">{at >= 0 ? at + 1 : ""}</span>
                      <Fit max={15} min={11} lines={2} className="font-medium">
                        {option}
                      </Fit>
                    </span>
                  </Pick>
                );
              })}
            </div>
          </section>
        ) : fork ? (
          <div className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2">
            <p className="glass pop-in rounded-xl px-3 py-2 font-semibold">
              <Fit max={14} min={11} lines={2}>
                {fork.pathA}
              </Fit>
            </p>
            <span className="font-pixel text-sm text-muted-foreground">or</span>
            <p className="glass pop-in pop-late rounded-xl px-3 py-2 font-semibold">
              <Fit max={14} min={11} lines={2}>
                {fork.pathB}
              </Fit>
            </p>
          </div>
        ) : failed ? (
          <p className="shrink-0 text-sm text-muted-foreground">
            {failed} You can still look.
          </p>
        ) : (
          <div
            className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2"
            aria-hidden
          >
            <span className="looking block h-11 rounded-xl bg-muted" />
            <span className="font-pixel text-sm text-muted-foreground">or</span>
            <span className="looking looking-late block h-11 rounded-xl bg-muted" />
          </div>
        )}

        {answered > 0 && !done ? (
          <button
            type="button"
            className={`shrink-0 self-start text-sm ${LINK}`}
            onClick={() => setIndex(0)}
          >
            {answered} answered · Change
          </button>
        ) : null}

        {!fork && !failed ? (
          <p role="status" className="font-pixel text-lg text-muted-foreground">
            Reading the decision.
          </p>
        ) : null}

        {current ? (
          <section
            key={current.text}
            className="enter-fade flex min-h-0 flex-col gap-3"
          >
            <div className="flex shrink-0 items-baseline justify-between gap-3">
              <h2 className="line-clamp-3 text-[1.35rem] leading-tight font-semibold text-balance">
                {current.text}
              </h2>
              <span className="shrink-0 font-pixel text-sm text-muted-foreground tabular-nums">
                {index + 1}/{questions.length}
              </span>
            </div>
            {current.choices.length > 0 ? (
              <div className="grid shrink-0 grid-cols-2 gap-2">
                {current.choices.map((choice) => (
                  <Pick
                    key={choice}
                    pressed={replies[index] === choice}
                    onClick={() => reply(choice)}
                    className="min-h-14 px-3 py-2 text-sm leading-snug [&:last-child:nth-child(odd)]:col-span-2"
                  >
                    <span className="line-clamp-2">{choice}</span>
                  </Pick>
                ))}
              </div>
            ) : null}
            {current.fear ? null : (
              <label className="flex shrink-0 flex-col gap-1.5">
                <span className="text-sm text-muted-foreground">
                  {current.choices.length > 0 ? "Or say it" : "Say it"}
                </span>
                <Input
                  value={draft}
                  maxLength={200}
                  autoComplete="off"
                  enterKeyHint="next"
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && typed) reply(typed);
                  }}
                  className="h-12 rounded-2xl px-4 text-base text-foreground md:text-base"
                />
              </label>
            )}
          </section>
        ) : null}

        {done ? (
          <div className="enter-fade flex min-h-0 flex-col gap-2">
            <p className="font-pixel text-2xl leading-tight">
              {saved.shot
                ? "Got it. Now people who chose something like this."
                : "Got it. Now the people who already chose."}
            </p>
            {index > 0 ? (
              <button
                type="button"
                className={`self-start text-sm ${LINK}`}
                onClick={() => setIndex(0)}
              >
                Change an answer
              </button>
            ) : null}
          </div>
        ) : null}
      </Shell>
    </Progress>
  );
}
