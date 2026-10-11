"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { SpeakBlob } from "@/components/blob";
import type { SavedDecision } from "@/lib/store";
import type { LiveSearch } from "./screens";

type Screen = string;

function lineFor(saved: SavedDecision, screen: Screen, live: LiveSearch) {
  const a = saved.result?.pathA ?? saved.fork?.pathA ?? "";
  const b = saved.result?.pathB ?? saved.fork?.pathB ?? "";
  if (screen === "ask") return `You said: ${saved.decision}. I'll name both paths.`;
  if (screen === "searching") {
    if (live.stories.length)
      return `${live.stories.length} posts so far. Still opening links.`;
    if (live.posts) return `${live.posts} posts found.`;
    return "Looking for people who already chose.";
  }
  if (screen === "facts") return "Check the spec facts first.";
  if (screen === "sides" && saved.result) {
    const n = saved.result.stories.filter(
      (story) => story.kind === "check-in" || (story.kind !== "sketch" && story.url),
    ).length;
    return `${n} posts. ${a} and ${b} both stay up.`;
  }
  if (screen === "gut") return "Something lands on a path. Then it reads your face on this phone.";
  if (screen === "card") {
    if (!saved.kept) return "Which one are you keeping?";
    const path = saved.kept === "a" ? a : b;
    return saved.reasons
      ? `You kept ${path}.`
      : `You kept ${path}. Write why before you close the door.`;
  }
  if (screen === "reasons") return "Why this one? If you come back worried, this shows first.";
  if (screen === "lock") return "Door closed. Your reasons, your curve, and your numbers are here.";
  if (screen === "checks") return "How is it now?";
  if (screen === "tryon") return "A photo of the thing, or of you. Same shot, both options.";
  if (screen === "future") return "Only from the posts on screen.";
  return "";
}

async function speak(text: string, signal: AbortSignal) {
  const res = await fetch("/api/speak", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
    signal,
  });
  if (!res.ok) throw new Error("Couldn't speak that.");
  const buf = await res.arrayBuffer();
  const ctx = new AudioContext();
  const audio = await ctx.decodeAudioData(buf.slice(0));
  const src = ctx.createBufferSource();
  src.buffer = audio;
  src.connect(ctx.destination);
  await new Promise<void>((resolve, reject) => {
    src.onended = () => resolve();
    signal.addEventListener("abort", () => {
      src.stop();
      void ctx.close();
      reject(new DOMException("aborted", "AbortError"));
    });
    src.start();
  });
  await ctx.close();
}

type Rec = {
  start: () => void;
  stop: () => void;
  onresult: ((ev: { results: { [i: number]: { 0: { transcript: string } } } }) => void) | null;
};

function listenOnce(): Promise<string> {
  const Ctor =
    typeof window !== "undefined" &&
    ((window as unknown as { SpeechRecognition?: new () => Rec }).SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: new () => Rec }).webkitSpeechRecognition);
  if (!Ctor) return Promise.reject(new Error("This browser won't listen."));
  return new Promise((resolve, reject) => {
    const rec = new Ctor();
    rec.onresult = (ev) => resolve(ev.results[0][0].transcript.trim());
    rec.start();
    window.setTimeout(() => {
      rec.stop();
      reject(new Error("Didn't catch that."));
    }, 8000);
  });
}

export function VoiceBar({
  saved,
  screen,
  live,
}: {
  saved: SavedDecision;
  screen: Screen;
  live: LiveSearch;
}) {
  const [mood, setMood] = useState<"idle" | "listen" | "talk">("idle");
  const [heard, setHeard] = useState("");
  const last = useRef("");
  const say = useEffectEvent(async (text: string) => {
    if (!text || text === last.current) return;
    last.current = text;
    const ac = new AbortController();
    setMood("talk");
    try {
      await speak(text, ac.signal);
    } catch {
      /* keep going */
    }
    setMood("idle");
  });

  useEffect(() => {
    void say(lineFor(saved, screen, live));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, live.posts, live.stories.length, saved.id]);

  async function hear() {
    setMood("listen");
    try {
      const text = await listenOnce();
      setHeard(text);
    } catch (err) {
      setHeard(err instanceof Error ? err.message : "Didn't catch that.");
    } finally {
      setMood("idle");
    }
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[5.5rem] z-20 mx-auto flex w-full max-w-md justify-center px-5">
      <button
        type="button"
        className="pointer-events-auto flex flex-col items-center gap-1 outline-none"
        onClick={() => void hear()}
      >
        <SpeakBlob mood={mood} />
        <span className="max-w-56 truncate font-pixel text-xs text-muted-foreground">
          {heard || (mood === "listen" ? "Listening" : mood === "talk" ? "Talking" : "Tap to talk")}
        </span>
      </button>
    </div>
  );
}
