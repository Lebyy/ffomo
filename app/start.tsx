"use client";

import { Camera, Mic } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, ViewTransition } from "react";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Shell } from "@/components/shell";
import AnimatedGradientText from "@/components/animata/text/animated-gradient-text";
import { Bubble } from "@/components/chat";
import { InstallHint } from "@/components/pwa";
import { Fit } from "@/components/fit";
import { STEP_LABEL } from "@/lib/flow";
import { shrinkPhoto } from "@/lib/photo";
import { saveDecision, useDecisions, type SavedDecision } from "@/lib/store";

export default function Start() {
  const router = useRouter();
  const [decision, setDecision] = useState("");
  const [sent, setSent] = useState("");
  const [shot, setShot] = useState("");
  const [error, setError] = useState("");
  const saved = useDecisions();
  const thread = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sent) return;
    const node = thread.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [sent]);

  function go(when: SavedDecision["when"], voice = false) {
    const text = (sent || decision).trim();
    if (!text) {
      setError(voice ? "Say what you're stuck on, then tap Talk." : "Say what you're stuck on.");
      return;
    }
    const id = crypto.randomUUID();
    saveDecision({
      id,
      decision: text,
      when,
      shot: shot || undefined,
      voice: voice || undefined,
    });
    router.push(`/d/${id}`);
  }

  function send() {
    const text = decision.trim();
    if (!text) {
      setError("Say what you're stuck on.");
      return;
    }
    setError("");
    setSent(text);
  }

  return (
    <ViewTransition enter="rise-in" exit="fade-out" default="none">
      <Shell step="Start">
        <div
          ref={thread}
          className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto [scrollbar-width:none]"
        >
          <AnimatedGradientText className="shrink-0 font-pixel text-sm">
            F the FOMO.
          </AnimatedGradientText>
          <Bubble from="ffomo" face>
            <p className="font-pixel text-lg leading-tight">What are you stuck on?</p>
            <p className="mt-1 text-muted-foreground">
              How it went for people who already chose, and what they wish
              they’d known. Then you decide.
            </p>
            <InstallHint />
          </Bubble>
          {sent ? (
            <>
              <Bubble from="you">
                <p>{sent}</p>
                {shot ? (
                  <img src={shot} alt="" className="mt-2 h-16 w-16 rounded-xl object-cover" />
                ) : null}
              </Bubble>
              <Bubble from="ffomo" face>
                <p>Have you already chosen?</p>
              </Bubble>
            </>
          ) : null}
          {!sent && saved.length > 0 ? (
            <div className="flex flex-col gap-2" aria-label="Your decisions">
              {saved.map((item) => (
                <Link
                  key={item.id}
                  href={`/d/${item.id}`}
                  className="glass flex items-center gap-3 rounded-2xl px-4 py-2.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <Fit max={16} min={12} className="font-semibold">
                      {item.decision}
                    </Fit>
                    <span className="truncate text-sm text-muted-foreground">
                      {statusOf(item)}
                    </span>
                  </span>
                  <span aria-hidden className="font-pixel text-xl text-primary">
                    ›
                  </span>
                </Link>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col gap-2 pt-3 pb-[max(0.9rem,env(safe-area-inset-bottom))]">
          {sent ? (
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Have you already chosen?">
              <Button
                type="button"
                className="ledge h-12 rounded-2xl font-pixel text-base"
                onClick={() => go("not-yet")}
              >
                Haven’t chosen
              </Button>
              <Button
                type="button"
                variant="outline"
                className="ledge ledge-quiet h-12 rounded-2xl font-pixel text-base"
                onClick={() => go("already")}
              >
                Already chose
              </Button>
              <button
                type="button"
                className="col-span-2 text-sm text-muted-foreground"
                onClick={() => setSent("")}
              >
                Change it
              </button>
            </div>
          ) : (
            <form
              className="flex items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                send();
              }}
            >
              <label
                aria-label="Add a photo of it, if you have one"
                className="ledge ledge-quiet grid size-12 shrink-0 cursor-pointer place-items-center rounded-2xl border border-border bg-card focus-within:ring-3 focus-within:ring-ring/50"
              >
                {shot ? (
                  <img src={shot} alt="" className="size-8 rounded-lg object-cover" />
                ) : (
                  <Camera aria-hidden className="size-5" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    void shrinkPhoto(file)
                      .then(setShot)
                      .catch(() => setError("Use a jpeg."));
                  }}
                />
              </label>
              <Textarea
                id="decision"
                name="decision"
                value={decision}
                autoFocus
                rows={1}
                placeholder="Job, or the other offer"
                enterKeyHint="send"
                aria-label="The decision"
                aria-invalid={error ? true : undefined}
                className="h-16 min-h-16 flex-1 resize-none rounded-2xl px-4 py-2 text-base leading-5 md:text-base"
                onChange={(event) => {
                  setDecision(event.target.value);
                  setError("");
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    send();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                aria-label="Talk"
                className="ledge ledge-quiet size-12 shrink-0 rounded-2xl p-0"
                onClick={() => go("not-yet", true)}
              >
                <Mic aria-hidden className="size-5" />
              </Button>
              <Button
                type="submit"
                className="ledge h-12 shrink-0 rounded-2xl px-4 font-pixel text-base"
              >
                Send
              </Button>
            </form>
          )}
          {error ? <FieldError className="enter-fade">{error}</FieldError> : null}
        </div>
      </Shell>
    </ViewTransition>
  );
}

function statusOf(item: SavedDecision) {
  if (!item.result) return item.asked ? "Looking" : "Questions";
  if (item.kept && item.result) {
    return `You picked ${item.kept === "a" ? item.result.pathA : item.result.pathB}.`;
  }
  return STEP_LABEL[item.step ?? "sides"];
}
