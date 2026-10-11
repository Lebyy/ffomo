"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { Input } from "@/components/ui/input";
import { Fit } from "@/components/fit";
import { Progress, Shell } from "@/components/shell";
import { FEARS, stakesOf, type Fear } from "@/lib/flow";
import type { Fork } from "@/lib/schema";
import type { Answer, SavedDecision } from "@/lib/store";
import { Bubble, Typing } from "@/components/chat";
import { LINK, NextButton, Pick, QuietButton } from "./screens";

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

const FEAR_Q = "What's missing?";

type Question = { text: string; choices: string[]; fear?: boolean };

export function AskScreen({
  saved,
  onFork,
  onDone,
  onBack,
}: {
  saved: SavedDecision;
  onFork: (fork: Fork, paired?: boolean) => void;
  onDone: (answers: Answer[], fear?: Fear, fearNote?: string) => void;
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
    let fearNote: string | undefined;
    questions.forEach((question, i) => {
      const value = replies[i];
      if (!value) return;
      if (question.fear) {
        fear = fearOptions.find((item) => item.label === value)?.id;
        fearNote = value;
      } else answers.push({ q: question.text, a: value });
    });
    onDone(answers, fear, fearNote);
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
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto [scrollbar-width:none]">
          <Bubble from="you">
            <p className="line-clamp-3">{saved.decision}</p>
            <p className="mt-1 text-xs opacity-80">
              {saved.when === "already" ? "Already chose" : "Haven’t chosen"}
            </p>
            {saved.shot ? (
              <img
                src={saved.shot}
                alt=""
                className="mt-2 h-16 w-16 rounded-xl object-cover"
              />
            ) : null}
          </Bubble>

          {replies.slice(0, index).map((answer, i) =>
            answer ? (
              <Bubble key={questions[i]?.text ?? i} from="you">
                <p className="line-clamp-3">{answer}</p>
              </Bubble>
            ) : null,
          )}

          {!fork && !failed ? <Typing /> : null}

          {failed && !fork ? (
            <Bubble from="ffomo" face>
              <p>
                {failed} You can still look.
              </p>
            </Bubble>
          ) : null}

          {fork && !choosing ? (
            <Bubble from="ffomo" face>
              <p>
                <Fit max={15} min={12} lines={2}>
                  {fork.pathA}
                </Fit>
              </p>
              <p className="my-1 font-pixel text-xs text-muted-foreground">or</p>
              <p>
                <Fit max={15} min={12} lines={2}>
                  {fork.pathB}
                </Fit>
              </p>
            </Bubble>
          ) : null}

          {choosing ? (
            <Bubble from="ffomo" face>
              <p className="font-medium">
                You named {options.length}. Which two first?
              </p>
              <p className="mt-1 text-muted-foreground">
                Tap two, in the order you think of them.
              </p>
            </Bubble>
          ) : null}

          {current ? (
            <Bubble key={current.text} from="ffomo" face>
              <p className="font-medium">{current.text}</p>
              <p className="mt-1 font-pixel text-xs text-muted-foreground tabular-nums">
                {index + 1}/{questions.length}
              </p>
            </Bubble>
          ) : null}

          {done ? (
            <Bubble from="ffomo" face>
              <p>
                {saved.shot
                  ? "Got it. Now people who chose something like this."
                  : "Got it. Now the people who already chose."}
              </p>
            </Bubble>
          ) : null}

          {answered > 0 && !done ? (
            <button
              type="button"
              className={`shrink-0 self-start text-sm ${LINK}`}
              onClick={() => setIndex(0)}
            >
              {answered} answered · Change
            </button>
          ) : null}
          {done && index > 0 ? (
            <button
              type="button"
              className={`self-start text-sm ${LINK}`}
              onClick={() => setIndex(0)}
            >
              Change an answer
            </button>
          ) : null}
        </div>

        {choosing ? (
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
                    <span className="w-4 shrink-0 font-pixel text-primary">
                      {at >= 0 ? at + 1 : ""}
                    </span>
                    <Fit max={15} min={11} lines={2} className="font-medium">
                      {option}
                    </Fit>
                  </span>
                </Pick>
              );
            })}
          </div>
        ) : null}

        {current ? (
          <div key={current.text} className="flex shrink-0 flex-col gap-2">
            {current.choices.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {current.choices.map((choice) => (
                  <Pick
                    key={choice}
                    pressed={replies[index] === choice}
                    onClick={() => reply(choice)}
                    className="min-h-12 px-3 py-2 text-sm leading-snug [&:last-child:nth-child(odd)]:col-span-2"
                  >
                    <span className="line-clamp-2">{choice}</span>
                  </Pick>
                ))}
              </div>
            ) : null}
            {current.fear ? null : (
              <Input
                value={draft}
                maxLength={200}
                autoComplete="off"
                enterKeyHint="send"
                aria-label={current.choices.length > 0 ? "Or say it" : "Say it"}
                placeholder={current.choices.length > 0 ? "Or say it" : "Say it"}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && typed) reply(typed);
                }}
                className="h-12 rounded-2xl px-4 text-base text-foreground md:text-base"
              />
            )}
          </div>
        ) : null}
      </Shell>
    </Progress>
  );
}
