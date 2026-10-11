"use client";

import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Bubble } from "@/components/chat";
import { Pair, Shell } from "@/components/shell";
import { Pager } from "@/components/pager";
import FluidTabs from "@/components/animata/tabs/fluid-tabs";
import { Fit } from "@/components/fit";
import { Pet, type Mood } from "@/components/pet";
import type { PetKind } from "@/lib/pets";
import {
  STEP_LABEL,
  costLine,
  disagree,
  fomoHits,
  problemOf,
  meterReady,
  reported,
  sensitiveOf,
  stakesOf,
  type Cost,
} from "@/lib/flow";
import { shrinkPhoto } from "@/lib/photo";
import {
  wishOf,
  type Beat,
  type DecideResult,
  type SideMeter,
  type Story,
  type Wish,
} from "@/lib/schema";
import type { SavedDecision } from "@/lib/store";
import { SettleRead } from "@/components/settle-view";
import { settleFork } from "@/lib/settle-map";
import { crowdWord, orderNote, orderSide, settle, visibleCount } from "@/lib/settle";

export const LINK =
  "rounded-sm text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50";
const FIELD = "h-12 rounded-2xl px-4 text-base text-foreground md:text-base";
const SMALL =
  "h-10 rounded-xl border border-border bg-muted/50 px-1 text-[13px] font-medium whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50";

export function Advice() {
  return (
    <p className="text-xs text-muted-foreground">
      What people wrote. Not advice.
    </p>
  );
}

function Raised({
  className,
  late,
  children,
}: {
  className?: string;
  late?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`pop-in ${late ? "pop-late" : ""} ${className ?? ""}`}>
      {children}
    </div>
  );
}

function later(months: number | undefined) {
  if (months == null) return null;
  if (months < 1) return "Just after";
  if (months === 1) return "1 month later";
  if (months < 12) return `${months} months later`;
  if (months < 24) return "A year later";
  return `${Math.floor(months / 12)} years later`;
}

export function Title({
  children,
  sub,
  pet,
  mood,
}: {
  children: React.ReactNode;
  sub?: React.ReactNode;
  pet?: PetKind;
  mood?: Mood;
}) {
  return (
    <Bubble from="ffomo" face={Boolean(pet)} pet={pet} mood={mood}>
      <p className="font-pixel text-lg leading-tight font-semibold text-balance">{children}</p>
      {sub ? <p className="mt-1 text-pretty text-muted-foreground">{sub}</p> : null}
    </Bubble>
  );
}

export function Pick({
  pressed,
  onClick,
  children,
  tone = "primary",
  className = "min-h-12 px-4 py-2.5 text-base",
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
  tone?: "primary" | "glad" | "regret";
  className?: string;
}) {
  const on =
    tone === "glad"
      ? "border-glad bg-glad/15"
      : tone === "regret"
        ? "border-regret bg-regret/15"
        : "border-primary bg-primary/15";
  return (
    <button
      type="button"
      aria-pressed={pressed}
      data-slot="button"
      className={`w-full rounded-2xl border-2 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${pressed ? `${on} glass` : "border-transparent bg-card [@media(hover:hover)]:hover:bg-muted"} ${className}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function NextButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      className="ledge h-13 w-full rounded-2xl font-pixel text-lg font-semibold"
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

export function QuietButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      className="ledge ledge-quiet h-13 w-full rounded-2xl text-base"
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function Bar({ meter }: { meter: SideMeter }) {
  const parts = [
    [meter.glad, "bg-glad"],
    [meter.regret, "bg-regret"],
    [meter.mixed ?? 0, "bg-mixed"],
    [meter.unclear ?? 0, "bg-muted-foreground/40"],
  ] as const;
  return (
    <div
      className="flex h-3 w-full gap-0.5 overflow-hidden rounded-[3px] bg-muted"
      aria-hidden
    >
      {parts.map(([count, color], index) =>
        count > 0 ? (
          <span
            key={index}
            className={`meter-grow h-full basis-0 rounded-[2px] ${color}`}
            style={{ flexGrow: count, animationDelay: `${index * 90}ms` }}
          />
        ) : null,
      )}
    </div>
  );
}

function Counts({ meter, strength }: { meter: SideMeter; strength?: number }) {
  const bits = [
    meter.glad > 0 ? (
      <span key="glad" className="text-glad">
        {meter.glad} glad
      </span>
    ) : null,
    meter.regret > 0 ? (
      <span key="regret" className="text-regret">
        {meter.regret} regret
      </span>
    ) : null,
    (meter.mixed ?? 0) > 0 ? (
      <span key="mixed" className="text-mixed">
        {meter.mixed} mixed
      </span>
    ) : null,
    (meter.unclear ?? 0) > 0 ? (
      <span key="unclear" className="text-muted-foreground">
        {meter.unclear} unclear
      </span>
    ) : null,
  ].filter((bit) => bit != null);
  return (
    <p className="text-xs font-medium tabular-nums">
      {bits.map((bit, index) => (
        <span key={index}>
          {index > 0 ? (
            <span className="text-muted-foreground"> · </span>
          ) : null}
          {bit}
        </span>
      ))}
      {strength != null ? (
        <span className="text-muted-foreground"> · strength {strength}</span>
      ) : null}
    </p>
  );
}

function SideSum({
  name,
  meter,
  pet,
  late,
}: {
  name: string;
  meter: SideMeter;
  pet: PetKind;
  late?: boolean;
}) {
  const count = reported(meter);
  const ready = meterReady(meter);
  return (
    <Raised
      late={late}
      className="flex min-w-0 flex-col gap-1 rounded-2xl bg-card px-3 py-2"
    >
      <div className="flex items-center gap-1.5">
        <p className="min-w-0 flex-1 font-semibold">
          <Fit max={14} min={11} lines={2}>
            {name}
          </Fit>
        </p>
        <Pet kind={pet} size={24} delay={late ? 300 : 0} />
      </div>
      {count === 0 ? (
        <p className="text-sm text-muted-foreground">
          No posts about this yet.
        </p>
      ) : (
        <>
          <p className="flex items-baseline gap-1.5">
            <span className="font-pixel text-2xl leading-none font-semibold tabular-nums">
              {count}
            </span>
            <span className="text-xs whitespace-nowrap text-muted-foreground">
              wrote later
            </span>
          </p>
          {ready ? <Bar meter={meter} /> : null}
          <Counts meter={meter} strength={ready ? meter.strength : undefined} />
          {crowdWord(meter.glad, meter.regret, meter.mixed ?? 0) ? (
            <p className="text-xs text-muted-foreground">
              {crowdWord(meter.glad, meter.regret, meter.mixed ?? 0)}
            </p>
          ) : null}
          {ready ? null : <p className="text-xs text-muted-foreground">Not enough to add up.</p>}
        </>
      )}
    </Raised>
  );
}

export function Versus({
  result,
  onLook,
}: {
  result: DecideResult;
  onLook?: () => void;
}) {
  const a = result.meter.a;
  const b = result.meter.b;
  return (
    <section
      className="flex shrink-0 flex-col gap-1.5"
      aria-label="What people reported"
    >
      <div className="grid grid-cols-2 gap-2">
        <SideSum name={result.pathA} meter={a} pet="cat" />
        <SideSum name={result.pathB} meter={b} pet="duck" late />
      </div>
      <p className="text-xs text-muted-foreground">
        What these posters reported. Not your odds. People who felt fine often
        don’t post.
        {disagree(a, b) ? (
          <span className="font-semibold text-foreground">
            {" "}
            They don’t agree.
          </span>
        ) : null}
        {onLook ? (
          <>
            {" "}
            <button
              type="button"
              className={`font-medium ${LINK}`}
              onClick={onLook}
            >
              Look again
            </button>
          </>
        ) : null}
      </p>
    </section>
  );
}

function Dots({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" title={`strength ${n}`}>
      <span className="sr-only">strength {n}</span>
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          aria-hidden
          className={`size-2 rounded-[1px] ${i <= n ? "bg-foreground" : "bg-muted-foreground/30"}`}
        />
      ))}
    </span>
  );
}

function feelingOf(feeling: Story["feeling"]) {
  if (feeling === "glad")
    return {
      edge: "border-glad/45",
      chip: "bg-glad/15 text-glad",
      label: "Glad",
    };
  if (feeling === "regret")
    return {
      edge: "border-regret/45",
      chip: "bg-regret/15 text-regret",
      label: "Regret",
    };
  if (feeling === "mixed")
    return {
      edge: "border-mixed/45",
      chip: "bg-mixed/15 text-mixed",
      label: "Mixed",
    };
  return {
    edge: "border-border",
    chip: "bg-muted text-muted-foreground",
    label: "Unclear",
  };
}

function Clamp({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const sheet = useRef<HTMLDialogElement>(null);
  const [cut, setCut] = useState(false);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => setCut(node.scrollHeight > node.clientHeight + 2);
    measure();
    void document.fonts.ready.then(measure);
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [text]);
  return (
    <>
      <button
        type="button"
        disabled={!cut}
        aria-label={cut ? "Read all" : undefined}
        className="relative min-h-0 flex-1 rounded-lg text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-auto"
        onClick={() => sheet.current?.showModal()}
      >
        <span
          ref={ref}
          className={`block h-full overflow-hidden text-[15px] leading-relaxed text-pretty ${cut ? "fade-cut" : ""}`}
        >
          {text}
        </span>
        {cut ? (
          <span className="absolute right-0 bottom-0 rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-primary">
            Read all
          </span>
        ) : null}
      </button>
      <dialog
        ref={sheet}
        className="sheet m-auto w-[min(92vw,26rem)] rounded-3xl bg-card p-5 text-foreground backdrop:bg-black/70"
        onClick={(event) => {
          if (event.target === event.currentTarget) sheet.current?.close();
        }}
      >
        <p className="text-base leading-relaxed text-pretty">{text}</p>
        <form method="dialog" className="mt-4">
          <button
            type="submit"
            data-slot="button"
            className="ledge h-12 w-full rounded-2xl bg-primary font-pixel text-lg text-primary-foreground"
          >
            Close
          </button>
        </form>
      </dialog>
    </>
  );
}

function StoryCard({ story, opening }: { story: Story; opening?: boolean }) {
  const tone = feelingOf(story.feeling);
  const fit =
    story.fit === "close"
      ? "Close to what you said"
      : story.fit === "unsure"
        ? "Details left out"
        : "";
  return (
    <article
      className={`flex h-full flex-col gap-2 overflow-hidden rounded-2xl border-2 bg-card p-3.5 ${tone.edge}`}
    >
      <div className="flex shrink-0 items-center gap-2 text-sm">
        <span className={`rounded-md px-2 py-0.5 font-pixel ${tone.chip}`}>
          {tone.label}
        </span>
        <span className="truncate text-muted-foreground">
          {later(story.monthsLater) ?? "Time not said"}
        </span>
        <Dots n={story.strength} />
        {story.kind === "check-in" ? (
          <span className="ml-auto shrink-0 text-muted-foreground">A check-in</span>
        ) : story.kind === "sketch" || !story.url ? (
          <span className="ml-auto shrink-0 text-muted-foreground">
            {opening ? "Opening the post" : "No later post"}
          </span>
        ) : (
          <a
            href={story.url}
            target="_blank"
            rel="noreferrer"
            className={`ml-auto shrink-0 font-medium ${LINK}`}
          >
            The post
          </a>
        )}
      </div>
      {story.image ? (
        <img
          src={story.image}
          alt=""
          referrerPolicy="no-referrer"
          className="h-28 w-full shrink-0 rounded-xl object-cover"
        />
      ) : null}
      <Clamp text={story.text} />
      {fit ? (
        <p className="shrink-0 truncate text-xs text-muted-foreground">{fit}</p>
      ) : null}
    </article>
  );
}

function Empty({ pet, children }: { pet: PetKind; children: string }) {
  return (
    <Bubble from="ffomo" face pet={pet} mood="sad">
      <p>{children}</p>
    </Bubble>
  );
}

function StoryPager({ stories }: { stories: Story[] }) {
  if (stories.length === 0)
    return <Empty pet="frog">No posts about this yet.</Empty>;
  return (
    <Pager
      items={stories}
      label="Stories"
      render={(story) => <StoryCard story={story} />}
    />
  );
}

function PathStories({
  result,
  path,
  mode,
  taken,
  refreshes,
}: {
  result: DecideResult;
  path: "a" | "b";
  mode: "decide" | "rescue";
  taken?: "a" | "b";
  refreshes: number;
}) {
  const rows = orderSide(
    result.stories
      .filter((story) => story.path === path && story.kind !== "sketch")
      .map((story) => ({ ...story, stance: story.feeling })),
    mode,
    path,
    taken,
  );
  const cap = visibleCount(rows.length, refreshes);
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <p className="shrink-0 text-xs text-muted-foreground">{orderNote(mode, path, taken)}</p>
      <StoryPager stories={rows.slice(0, cap.show)} />
    </div>
  );
}

function wishHead(n: number) {
  return n === 1
    ? "1 thing they wish they'd known"
    : `${n} things they wish they'd known`;
}

function Sources({ urls }: { urls: string[] }) {
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-1">
      {urls.map((url, index) => (
        <a
          key={url}
          href={url}
          target="_blank"
          rel="noreferrer"
          className={`text-sm font-medium ${LINK}`}
        >
          {urls.length === 1 ? "The post" : `Post ${index + 1}`}
        </a>
      ))}
    </span>
  );
}

function WishPager({ wish }: { wish: Wish[] }) {
  if (wish.length === 0)
    return <Empty pet="owl">No post said what they wish they’d known.</Empty>;
  return (
    <Pager
      items={wish}
      label={wishHead(wish.length)}
      render={(item) => (
        <article className="flex h-full flex-col gap-2 overflow-hidden rounded-2xl border-2 border-primary/35 bg-card px-4 py-3">
          <div className="flex shrink-0 items-center justify-between gap-2">
            <p className="font-pixel text-sm text-primary">
              {item.urls.length === 1 ? "One post says this" : `${item.urls.length} posts say this`}
            </p>
            <Sources urls={item.urls} />
          </div>
          <Clamp text={item.text.charAt(0).toUpperCase() + item.text.slice(1)} />
        </article>
      )}
    />
  );
}

function hostOf(url: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host.endsWith("vertexaisearch.cloud.google.com") ? "" : host;
  } catch {
    return "";
  }
}

// Says where the posts came from and what was left out.
function whoLine(result: DecideResult) {
  const posts = result.stories.filter(
    (story) => story.kind === "check-in" || (story.kind !== "sketch" && story.url),
  );
  const hosts = [
    ...new Set(
      posts.flatMap((story) => {
        const host = story.url ? hostOf(story.url) : story.kind === "check-in" ? "check-ins" : "";
        return host ? [host] : [];
      }),
    ),
  ];
  const from =
    hosts.length === 0
      ? ""
      : hosts.length <= 2
        ? hosts.join(", ")
        : `${hosts.slice(0, 2).join(", ")} +${hosts.length - 2}`;
  const n = posts.length;
  const left = [
    result.skipped ? `${result.skipped} advice posts skipped` : "",
    result.dropped ? `${result.dropped} dead links dropped` : "",
  ].filter(Boolean);
  const count = n ? `${n} ${n === 1 ? "post" : "posts"}` : "";
  return [from ? `${count} from ${from}` : count, ...left].filter(Boolean).join(" · ");
}

function stamp(time: number) {
  return new Date(time).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function FactsScreen({
  result,
  label,
  onNext,
  gate,
  ready = true,
}: {
  result: DecideResult;
  label: string;
  onNext: () => void;
  gate?: React.ReactNode;
  ready?: boolean;
}) {
  const facts = result.facts ?? [];
  return (
    <Shell
      step={STEP_LABEL.facts}
      action={
        <NextButton disabled={!ready} onClick={onNext}>
          {label}
        </NextButton>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto [scrollbar-width:none]">
      <Title
        sub={
          facts.length
            ? `Facts from spec pages${result.factsAt ? `, checked ${stamp(result.factsAt)}` : ""}. Read these before the stories.`
            : "No spec page answered this, so nothing here is checked."
        }
        pet="owl"
        mood={facts.length ? "look" : "sad"}
      >
        Check this first
      </Title>
      {facts.length === 0 ? (
        <Empty pet="owl">
          Unchecked. Find the official page before you lean on anyone’s story.
        </Empty>
      ) : (
        <ul className="flex shrink-0 flex-col gap-2">
          {facts.map((fact) => (
            <li key={fact.url}>
              <a
                href={fact.url}
                target="_blank"
                rel="noreferrer"
                className="flex flex-col gap-1.5 rounded-2xl bg-card p-3.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.99]"
              >
                <span className="truncate text-xs text-muted-foreground">{fact.source}</span>
                <span className="text-pretty text-sm leading-snug">{fact.text}</span>
                <span className={`text-sm font-medium ${LINK}`}>Open the page</span>
              </a>
            </li>
          ))}
        </ul>
      )}
      {result.unknown?.length ? (
        <div className="shrink-0 rounded-2xl bg-card px-3.5 py-3">
          <p className="text-xs text-muted-foreground">The posts won’t tell you</p>
          <ul className="mt-1.5 flex flex-col gap-1">
            {result.unknown.map((item) => (
              <li key={item} className="text-sm text-pretty leading-snug">
                {item}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {gate}
      </div>
    </Shell>
  );
}

const WHEN_LABEL: Record<Beat["when"], string> = {
  "1 week": "A week in",
  "1 year": "A year in",
  "5 years": "Five years in",
};

const WHEN_ORDER: Beat["when"][] = ["1 week", "1 year", "5 years"];

function beatsOf(result: DecideResult) {
  return [
    ...result.futureA.map((beat) => ({ beat, path: result.pathA })),
    ...result.futureB.map((beat) => ({ beat, path: result.pathB })),
  ].sort(
    (x, y) => WHEN_ORDER.indexOf(x.beat.when) - WHEN_ORDER.indexOf(y.beat.when),
  );
}

function BeatPager({
  result,
  images,
  drawing,
}: {
  result: DecideResult;
  images?: Record<string, string>;
  drawing?: boolean;
}) {
  const beats = beatsOf(result);
  if (beats.length === 0) {
    const posts = result.stories.some((story) => story.kind !== "sketch" && story.url);
    return (
      <Empty pet="frog">
        {posts
          ? "No matching point in time on both paths."
          : "No posts about this yet."}
      </Empty>
    );
  }
  return (
    <Pager
      items={beats}
      label="Later"
      render={({ beat, path }) => {
        const shot = images?.[`${beat.when}-${beat.url}`];
        return (
          <article className="flex h-full flex-col gap-2 overflow-hidden rounded-2xl bg-card p-4">
            <div className="flex shrink-0 items-baseline justify-between gap-2">
              <h2 className="font-pixel text-xl text-primary">
                {WHEN_LABEL[beat.when]}
              </h2>
              <p className="truncate text-sm text-muted-foreground">{path}</p>
            </div>
            {shot ? (
              <img
                src={shot}
                alt="Drawn from that post"
                className="enter-fade min-h-0 w-full flex-1 rounded-xl object-cover"
              />
            ) : drawing ? (
              <p className="text-sm text-muted-foreground">Drawing both paths.</p>
            ) : null}
            <p
              className={`${shot ? "line-clamp-2 shrink-0" : "line-clamp-6 min-h-0 flex-1 text-xl leading-snug font-medium"} text-pretty`}
            >
              {beat.text}
            </p>
            <a
              href={beat.url}
              target="_blank"
              rel="noreferrer"
              className={`shrink-0 self-start text-sm font-medium ${LINK}`}
            >
              The post
            </a>
          </article>
        );
      }}
    />
  );
}

function Tabs<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (id: T) => void;
  label: string;
}) {
  const index = Math.max(
    0,
    options.findIndex((option) => option.id === value),
  );
  return (
    <FluidTabs
      className="shrink-0"
      activeIndex={index}
      onActiveIndexChange={(next) => {
        const option = options[next];
        if (option) onChange(option.id);
      }}
    >
      <FluidTabs.List aria-label={label} className="w-full overflow-hidden rounded-2xl bg-muted/70 p-1 shadow-none">
        {options.map((option) => (
          <FluidTabs.Tab key={option.id} className="min-h-9 px-1 py-1">
            <FluidTabs.Label className="w-full whitespace-normal text-center leading-tight">
              <Fit max={14} min={10} lines={2}>
                {option.label}
              </Fit>
            </FluidTabs.Label>
          </FluidTabs.Tab>
        ))}
      </FluidTabs.List>
    </FluidTabs>
  );
}

function PhotoButton({
  label,
  busy,
  onFile,
}: {
  label: string;
  busy: boolean;
  onFile: (file: File | undefined) => void;
}) {
  return (
    <label
      data-slot="button"
      className={`ledge ledge-quiet flex h-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-border bg-card text-sm font-medium focus-within:ring-3 focus-within:ring-ring/50 ${busy ? "opacity-50" : ""}`}
    >
      {busy ? "Drawing" : label}
      <input
        type="file"
        accept="image/*"
        className="sr-only"
        disabled={busy}
        onChange={(event) => onFile(event.target.files?.[0])}
      />
    </label>
  );
}

async function drawImage(image: string, caption: string, kind?: "face" | "item") {
  const res = await fetch("/api/preview", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ image, mimeType: "image/jpeg", caption, kind }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    image?: string;
    mimeType?: string;
    error?: string;
  };
  if (!res.ok || !body.image)
    throw new Error(body.error ?? "Could not draw that.");
  return `data:${body.mimeType ?? "image/png"};base64,${body.image}`;
}

// Both paths get a picture at the same horizon, or neither does.
function drawList(result: DecideResult) {
  const picked: Beat[] = [];
  for (const when of WHEN_ORDER) {
    const a = result.futureA.find((beat) => beat.when === when);
    const b = result.futureB.find((beat) => beat.when === when);
    if (a && b) picked.push(a, b);
    if (picked.length === 4) break;
  }
  return picked;
}

function aboutThem(saved: SavedDecision) {
  return [
    saved.when === "already" ? "Already did" : "Not yet",
    ...(saved.answers ?? []).map((item) => item.a),
  ].join(" · ");
}

export type LiveStory = Story & { key: string; opening?: boolean };

export type LiveSearch = {
  queries: string[];
  posts: number;
  checking: boolean;
  stories: LiveStory[];
  retries: number;
};

export const NO_LIVE: LiveSearch = { queries: [], posts: 0, checking: false, stories: [], retries: 0 };

function liveLine(live: LiveSearch) {
  if (live.stories.length > 0) return "More posts still coming.";
  if (live.checking) return "Opening every link.";
  if (live.posts > 0) return `${live.posts} ${live.posts === 1 ? "post" : "posts"} found. Still reading.`;
  const query = live.queries.at(-1);
  if (query) return `Searching “${query}”`;
  if (live.retries > 0) return "That model was busy. Trying the next one.";
  return "Looking for people who already chose.";
}

export function SearchingScreen({
  saved,
  live,
  onCancel,
}: {
  saved: SavedDecision;
  live: LiveSearch;
  onCancel: () => void;
}) {
  const fork = saved.fork;
  const [pick, setPick] = useState<"a" | "b" | null>(null);
  const shown = pick ?? live.stories[0]?.path ?? "a";
  const sideStories = live.stories.filter((story) => story.path === shown);
  const arrived = live.stories.length > 0;
  return (
    <Shell
      step={STEP_LABEL.sides}
      action={<QuietButton onClick={onCancel}>Stop looking</QuietButton>}
    >
      <Title sub={aboutThem(saved)}>{saved.decision}</Title>
      {arrived ? (
        <Tabs
          value={shown}
          options={[
            { id: "a", label: fork?.pathA || "One side" },
            { id: "b", label: fork?.pathB || "The other" },
          ]}
          onChange={setPick}
          label="Path"
        />
      ) : (
        <div className="grid shrink-0 grid-cols-2 gap-2.5">
          {(["a", "b"] as const).map((key, index) => {
            const name = key === "a" ? fork?.pathA : fork?.pathB;
            return (
              <div
                key={key}
                className={`pop-in flex flex-col gap-2 rounded-2xl bg-card p-4 ${index === 1 ? "pop-late" : ""}`}
              >
                {name ? (
                  <p className="min-h-10 font-semibold">
                    <Fit max={14} min={11} lines={2}>
                      {name}
                    </Fit>
                  </p>
                ) : (
                  <span className="looking block h-5 w-3/4 rounded-md bg-muted" />
                )}
                <span className="looking block h-8 w-1/3 rounded-md bg-muted" />
              </div>
            );
          })}
        </div>
      )}
      {arrived ? (
        sideStories.length > 0 ? (
          <Pager
            items={sideStories}
            label="Stories"
            render={(story) => <StoryCard story={story} opening={story.opening} />}
          />
        ) : (
          <p className="min-h-0 flex-1 text-sm text-muted-foreground">Still looking on this side.</p>
        )
      ) : (
        <div className="flex min-h-0 flex-1 flex-col justify-end gap-3">
          <div className="walk-track border-b-4 border-dotted border-muted pb-1">
            <span className="walker">
              <Pet kind="pup" mood="walk" size={48} />
            </span>
          </div>
        </div>
      )}
      <Bubble from="ffomo">
        <p role="status" aria-live="polite" className="font-pixel text-base leading-snug">
          {liveLine(live)}
        </p>
      </Bubble>
    </Shell>
  );
}

type SideView = "a" | "b" | "wish" | "later";

export function SidesScreen({
  saved,
  error,
  next,
  onLook,
  onReveal,
  onNext,
}: {
  saved: SavedDecision;
  error: string;
  next: string;
  onLook: () => void;
  onReveal: () => void;
  onNext: () => void;
}) {
  const result = saved.result;
  const [view, setView] = useState<SideView>(saved.fear === "fact" ? "wish" : "a");

  if (!result) {
    return (
      <Shell
        step={STEP_LABEL.sides}
        action={<NextButton onClick={onLook}>Try again</NextButton>}
      >
        <Title sub={aboutThem(saved)}>{saved.decision}</Title>
        <Empty pet="duck">{error || "The search stopped."}</Empty>
      </Shell>
    );
  }

  const small = stakesOf(saved) === "small" && beatsOf(result).length > 0;
  const wish = wishOf(result);
  const mode = saved.when === "already" ? "rescue" : "decide";
  const taken = saved.when === "already" ? ("a" as const) : undefined;
  const blocked = (saved.refreshes ?? 0) >= 2;
  const options: { id: SideView; label: string }[] = [
    { id: "a", label: result.pathA },
    { id: "b", label: result.pathB },
    ...(wish.length === 0 ? [] : [{ id: "wish" as const, label: `Wish (${wish.length})` }]),
    ...(!small ? [] : [{ id: "later" as const, label: "Later" }]),
  ];
  const shown = options.some((option) => option.id === view) ? view : "a";
  const note = [
    saved.fork?.others?.length
      ? `Also on your list: ${saved.fork.others.join(", ")}.`
      : "",
    sensitiveOf(saved.decision) ? "Other people's experiences. Not advice." : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Shell
      step={STEP_LABEL.sides}
      action={<NextButton onClick={onNext}>{next}</NextButton>}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain [scrollbar-width:none]">
        <Bubble from="you">
          <p className="line-clamp-3">{saved.decision}</p>
        </Bubble>
        {saved.kept ? (
          <Bubble from="ffomo">
            <p>
              You picked {saved.kept === "a" ? result.pathA : result.pathB}. Same posts. They don’t reopen the other one.
            </p>
          </Bubble>
        ) : null}
        <Bubble from="ffomo" face pet="owl" mood="look">
          <p>{whoLine(result) || aboutThem(saved)}</p>
          {note ? <p className="mt-1 text-muted-foreground">{note}</p> : null}
        </Bubble>
        {error ? (
          <Bubble from="ffomo">
            <p className="text-regret">{error}</p>
          </Bubble>
        ) : null}
        <Versus result={result} onLook={blocked ? undefined : onReveal} />
        {blocked ? (
          <Bubble from="ffomo">
            <p>The record is unchanged.</p>
          </Bubble>
        ) : null}
        {saved.kept ? null : <StopLooking saved={saved} />}
        <Tabs
          value={shown}
          options={options}
          onChange={setView}
          label="Show"
        />
        <div className="flex min-h-64 shrink-0 flex-col">
          {shown === "wish" ? (
            <WishPager wish={wish} />
          ) : shown === "later" ? (
            <BeatPager result={result} />
          ) : (
            <PathStories
              result={result}
              path={shown === "b" ? "b" : "a"}
              mode={mode}
              taken={taken}
              refreshes={saved.refreshes ?? 0}
            />
          )}
        </div>
      </div>
    </Shell>
  );
}

function StopLooking({ saved }: { saved: SavedDecision }) {
  const result = saved.result;
  if (!result) return null;
  const hits = fomoHits(result, saved.kept);
  const wish = wishOf(result)[0];
  const cost = saved.fear === "money" ? savedCost(saved) : "";
  const empty = hits.length === 0 && !wish && !cost;
  return (
    <>
      <Bubble from="ffomo">
        <p className="font-pixel text-sm text-primary">What's missing</p>
        <p className="mt-1 font-medium">{problemOf(saved.fear, saved.fearNote || saved.fearLine)}</p>
        {empty ? <p className="mt-1">No post answered this yet.</p> : null}
      </Bubble>
      {wish ? (
        <Bubble from="ffomo">
          <p className="text-muted-foreground">Check this</p>
          <p className="mt-1 text-pretty">{wish.text}</p>
          <a href={wish.urls[0]} target="_blank" rel="noreferrer" className={`${LINK} mt-2 block`}>
            The post
          </a>
        </Bubble>
      ) : null}
      {cost ? (
        <Bubble from="ffomo">
          <p className="text-muted-foreground">Your number</p>
          <p className="mt-1 text-pretty">{cost}</p>
        </Bubble>
      ) : null}
      {hits.map((hit) => (
        <Bubble key={hit.path} from="ffomo">
          <p className="font-medium">{hit.name}</p>
          <p className="mt-1 text-muted-foreground">{hit.when}</p>
          <p className="mt-1 text-pretty">{hit.text}</p>
          {hit.url ? (
            <a href={hit.url} target="_blank" rel="noreferrer" className={`${LINK} mt-2 block`}>
              The post
            </a>
          ) : null}
        </Bubble>
      ))}
    </>
  );
}

function savedCost(saved: SavedDecision) {
  if (!saved.cost) return null;
  return costLine(
    saved.cost,
    saved.when === "not-yet" ? saved.result?.pathB : undefined,
  );
}

export function CostScreen({
  cost,
  paths,
  onNext,
  onSkip,
  label,
  named,
}: {
  cost?: Cost;
  paths?: [string, string];
  onNext: (cost: Cost) => void;
  onSkip: () => void;
  label: string;
  named?: string;
}) {
  const [keep, setKeep] = useState(cost?.keep ?? "");
  const [leave, setLeave] = useState(cost?.leave ?? "");
  const line = costLine({ keep, leave }, paths?.[1]);
  return (
    <Shell
      step={STEP_LABEL.cost}
      action={
        <Pair>
          <QuietButton onClick={onSkip}>No numbers</QuietButton>
          <NextButton disabled={!line} onClick={() => onNext({ keep, leave })}>
            {label}
          </NextButton>
        </Pair>
      }
    >
      <Title
        sub={
          named
            ? `${named}. From today on, in your own numbers. What you already paid is gone.`
            : "From today on, in your own numbers. What you already paid is gone on both paths, so it isn't counted."
        }
        pet="duck"
        mood={line ? "hop" : "idle"}
      >
        What would each cost from here?
      </Title>
      {[
        { name: paths?.[0] ?? "Keep things as they are", value: keep, set: setKeep },
        { name: paths?.[1] ?? "Switch", value: leave, set: setLeave },
      ].map((field) => (
        <label key={field.name} className="flex shrink-0 flex-col gap-1.5">
          <span className="truncate text-sm text-muted-foreground">
            {field.name}
          </span>
          <Input
            inputMode="decimal"
            autoComplete="off"
            placeholder="0"
            value={field.value}
            onChange={(event) => field.set(event.target.value)}
            className={FIELD}
          />
        </label>
      ))}
      {line ? (
        <Bubble key={line} from="ffomo">
          <p className="font-pixel text-lg">{line}</p>
        </Bubble>
      ) : null}
      <Advice />
    </Shell>
  );
}

export function MustScreen({
  result,
  musts,
  marks,
  enough,
  open,
  onSave,
  onMarks,
  onClear,
  onEnough,
  onNext,
  label,
}: {
  result: DecideResult;
  musts?: string[];
  marks?: { a: boolean; b: boolean }[];
  enough?: string;
  open?: string[];
  onSave: (musts: string[]) => void;
  onMarks: (marks: { a: boolean; b: boolean }[]) => void;
  onClear: () => void;
  onEnough: (check: { sentence: string; path: "a" | "b" | "both" | "neither"; open: string[] }) => void;
  onNext: () => void;
  label: string;
}) {
  const [three, setThree] = useState(
    musts?.length === 3 ? musts : ["", "", ""],
  );
  const [boxes, setBoxes] = useState(
    () => marks ?? [{ a: false, b: false }, { a: false, b: false }, { a: false, b: false }],
  );
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const ready = three.every((item) => item.trim());

  async function check() {
    const next = three.map((item) => item.trim());
    setChecking(true);
    setError("");
    onSave(next);
    try {
      const res = await fetch("/api/enough", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          pathA: result.pathA,
          pathB: result.pathB,
          stories: result.stories.slice(0, 12).map((story) => ({
            path: story.path,
            text: story.text.slice(0, 400),
          })),
          musts: next,
          facts: (result.facts ?? []).map((fact) => ({ text: fact.text })),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        sentence?: string;
        path?: "a" | "b" | "both" | "neither";
        open?: string[];
        error?: string;
      };
      if (!res.ok || !body.sentence)
        throw new Error(body.error ?? "Could not check that.");
      onEnough({ sentence: body.sentence, path: body.path ?? "neither", open: body.open ?? [] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not check that.");
    } finally {
      setChecking(false);
    }
  }

  function edit(index: number, value: string) {
    const next = three.slice();
    next[index] = value;
    setThree(next);
    if (enough) onClear();
  }

  return (
    <Shell
      step={STEP_LABEL.must}
      action={
        enough || error ? (
          <NextButton onClick={onNext}>{label}</NextButton>
        ) : (
          <div className="grid grid-cols-[auto_1fr] gap-2.5">
            <QuietButton onClick={onNext}>Skip</QuietButton>
            <NextButton
              disabled={!ready || checking}
              onClick={() => void check()}
            >
              {checking ? "Checking" : "Check"}
            </NextButton>
          </div>
        )
      }
    >
      <Title
        sub="Good enough beats perfect. If a path covers all three, you will hear it."
        pet="dino"
        mood={enough ? "cheer" : checking ? "look" : "idle"}
      >
        Name three must-haves
      </Title>
      <div className="flex shrink-0 flex-col gap-2.5">
        {three.map((value, index) => (
          <label key={index} className="flex items-center gap-3">
            <span className="w-5 shrink-0 font-pixel text-2xl text-primary tabular-nums">
              {index + 1}
            </span>
            <span className="sr-only">Must-have {index + 1}</span>
            <Input
              value={value}
              maxLength={200}
              autoComplete="off"
              onChange={(event) => edit(index, event.target.value)}
              className={FIELD}
            />
            <button
              type="button"
              aria-pressed={boxes[index]?.a}
              className={`h-10 shrink-0 rounded-xl border-2 px-2 text-xs ${boxes[index]?.a ? "border-primary bg-primary/15" : "border-border"}`}
              onClick={() => {
                const next = boxes.map((box, i) => (i === index ? { ...box, a: !box.a } : box));
                setBoxes(next);
                onMarks(next);
              }}
            >
              A
            </button>
            <button
              type="button"
              aria-pressed={boxes[index]?.b}
              className={`h-10 shrink-0 rounded-xl border-2 px-2 text-xs ${boxes[index]?.b ? "border-primary bg-primary/15" : "border-border"}`}
              onClick={() => {
                const next = boxes.map((box, i) => (i === index ? { ...box, b: !box.b } : box));
                setBoxes(next);
                onMarks(next);
              }}
            >
              B
            </button>
          </label>
        ))}
      </div>
      {enough ? (
        <Bubble from="ffomo">
          <p className="font-semibold">{enough}</p>
          {open?.length ? (
            <p className="mt-1 text-muted-foreground">
              Nothing here answers: {open.join(" · ")}
            </p>
          ) : null}
        </Bubble>
      ) : null}
      {error ? (
        <Bubble from="ffomo">
          <p className="text-regret">{error}</p>
        </Bubble>
      ) : null}
    </Shell>
  );
}

export function FutureScreen({
  result,
  shot,
  onShot,
  onNext,
  label,
  named,
}: {
  result: DecideResult;
  shot?: string;
  onShot?: (image: string) => void;
  onNext: () => void;
  label: string;
  named?: string;
}) {
  const [images, setImages] = useState<Record<string, string>>({});
  const [drawing, setDrawing] = useState(false);
  const [error, setError] = useState("");
  const any = drawList(result).length > 0;
  const drew = useRef(false);

  async function onFile(file: File | undefined, snap?: string) {
    if (!file && !snap) return;
    setError("");
    setDrawing(true);
    try {
      const image = snap ?? (file ? await shrinkPhoto(file) : "");
      if (!image) return;
      onShot?.(image);
      const beats = drawList(result);
      const drawn = await Promise.all(
        beats.map(async (beat) => {
          try {
            const src = await drawImage(
              image,
              `A scene from someone else's post, not a prediction: ${beat.text}. No extra money, cars, baldness, or distress.`,
              "face",
            );
            return [`${beat.when}-${beat.url}`, src] as const;
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not draw that.");
            return null;
          }
        }),
      );
      const got = new Map<string, string>();
      for (const row of drawn) if (row) got.set(row[0], row[1]);
      const next = { ...images };
      for (const when of WHEN_ORDER) {
        const pair = beats.filter((beat) => beat.when === when);
        if (pair.length < 2) continue;
        const keys = pair.map((beat) => `${beat.when}-${beat.url}`);
        if (!keys.every((key) => got.has(key))) continue;
        for (const key of keys) {
          const src = got.get(key);
          if (src) next[key] = src;
        }
      }
      setImages(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Use a jpeg.");
    } finally {
      setDrawing(false);
    }
  }

  useEffect(() => {
    if (!shot || !any || drew.current) return;
    drew.current = true;
    void onFile(undefined, shot);
  }, [shot, any]);

  return (
    <Shell
      step={STEP_LABEL.future}
      action={<NextButton onClick={onNext}>{label}</NextButton>}
    >
      <Title
        sub={
          named
            ? `${named}. Only from the posts on screen. Not a prediction.`
            : "Only from the posts on screen. Not a prediction."
        }
        pet="frog"
        mood={drawing ? "look" : "idle"}
      >
        Future you
      </Title>
      {shot && !any ? (
        <p className="shrink-0 text-xs text-muted-foreground">
          No pictures. Both paths need a post at the same point in time.
        </p>
      ) : null}
      {shot && any ? (
        <div className="flex shrink-0 flex-col gap-2">
          <PhotoButton
            label="Use a different photo"
            busy={drawing}
            onFile={(file) => void onFile(file)}
          />
          <p className="text-xs text-muted-foreground">
            {drawing
              ? "Drawing both paths from the posts."
              : "Using the photo you added. Sent to Google to draw both paths."}
          </p>
        </div>
      ) : null}
      {error ? <p className="shrink-0 text-sm text-regret">{error}</p> : null}
      <BeatPager result={result} images={images} drawing={drawing} />
    </Shell>
  );
}

export function TryScreen({
  result,
  shot,
  onShot,
  onNext,
  label,
}: {
  result: DecideResult;
  shot?: string;
  onShot?: (image: string) => void;
  onNext: () => void;
  label: string;
}) {
  const [photo, setPhoto] = useState(shot ?? "");
  const [kind, setKind] = useState<"face" | "item">("item");
  const [worn, setWorn] = useState<{ a?: string; b?: string }>({});
  const [drawing, setDrawing] = useState(false);
  const [error, setError] = useState("");
  const [side, setSide] = useState<"a" | "b">("a");
  const sides = [
    { key: "a" as const, name: result.pathA },
    { key: "b" as const, name: result.pathB },
  ];
  const drew = useRef(false);

  function keep(image: string, nextKind: "face" | "item") {
    setPhoto(image);
    setKind(nextKind);
    setWorn({});
    onShot?.(image);
  }

  async function onFile(file: File | undefined, nextKind: "face" | "item") {
    if (!file) return;
    setError("");
    try {
      keep(await shrinkPhoto(file), nextKind);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Use a jpeg.");
    }
  }

  async function wear() {
    if (!photo) return;
    setDrawing(true);
    setError("");
    const drawn = await Promise.all(
      sides.map(async (item) => {
        try {
          const src = await drawImage(
            photo,
            kind === "item"
              ? `This item as the choice named ${item.name}. Keep the item recognizable. No text. Not a prediction.`
              : `Same person. This choice: ${item.name}. Keep their face, age, and hair. No text. Not a prediction.`,
            kind,
          );
          return [item.key, src] as const;
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not draw that.");
          return null;
        }
      }),
    );
    const next = { ...worn };
    for (const row of drawn) if (row) next[row[0]] = row[1];
    setWorn(next);
    setDrawing(false);
  }

  useEffect(() => {
    if (!photo || drew.current) return;
    drew.current = true;
    void wear();
  }, [photo]);

  return (
    <Shell
      step={STEP_LABEL.tryon}
      action={<NextButton onClick={onNext}>{label}</NextButton>}
    >
      <Title sub={photo ? "Same shot, both options." : "How people felt about it later."}>
        Try it on
      </Title>
      {photo ? (
      <>
      <div className="grid h-[18dvh] shrink-0 grid-cols-2 gap-2.5">
        {sides.map((item) => {
          const shot = worn[item.key] || photo;
          return (
            <figure key={item.key} className="flex min-h-0 min-w-0 flex-col gap-1.5">
              {shot ? (
                <img
                  src={shot}
                  alt={item.name}
                  className="min-h-0 w-full flex-1 rounded-2xl object-cover"
                />
              ) : (
                <div className="grid min-h-0 flex-1 place-items-center rounded-2xl border-2 border-dashed border-border">
                  <Pet kind={item.key === "a" ? "cat" : "duck"} size={44} />
                </div>
              )}
              <figcaption className="truncate text-sm font-medium">
                {item.name}
              </figcaption>
            </figure>
          );
        })}
      </div>
      <div className="grid shrink-0 grid-cols-2 gap-2">
        <PhotoButton
          label="Photo of it"
          busy={false}
          onFile={(file) => void onFile(file, "item")}
        />
        <PhotoButton
          label="My face"
          busy={false}
          onFile={(file) => void onFile(file, "face")}
        />
        <button
          type="button"
          data-slot="button"
          className={`ledge ledge-quiet ${SMALL} col-span-2 h-11`}
          disabled={!photo || drawing}
          onClick={() => void wear()}
        >
          {drawing ? "Drawing" : kind === "item" ? "Show both" : "Show it on me"}
        </button>
      </div>
      </>
      ) : null}
      {error ? <p className="shrink-0 text-sm text-regret">{error}</p> : null}
      <Tabs
        value={side}
        options={sides.map((item) => ({ id: item.key, label: item.name }))}
        onChange={setSide}
        label="Stories from"
      />
      <StoryPager
        key={side}
        stories={result.stories.filter((story) => story.path === side && story.kind !== "sketch")}
      />
    </Shell>
  );
}


// Names the disagreement. Never picks between them.
function mustVsCrowd(saved: SavedDecision, result: DecideResult, kept: "a" | "b") {
  const fit = saved.enoughPath;
  if (!fit) return "";
  const other = kept === "a" ? "b" : "a";
  const crowd = result.meter[kept];
  if (fit === other)
    return `They fit ${other === "a" ? result.pathA : result.pathB} better. Both can be true.`;
  if ((fit === kept || fit === "both") && meterReady(crowd) && crowd.regret > crowd.glad)
    return "More posters on this path reported regret than glad. Both can be true.";
  return "";
}

function unknownOf(saved: SavedDecision, result: DecideResult) {
  const lines = [...(saved.open ?? []), ...(result.unknown ?? [])];
  return lines.length ? lines.slice(0, 3).join(" · ") : "";
}

export function CardScreen({
  saved,
  onPick,
  onLook,
  onLeave,
  onReasons,
  onCheck,
  onReopen,
}: {
  saved: SavedDecision;
  onPick: (path: "a" | "b") => void;
  onLook: () => void;
  onLeave: () => void;
  onReasons: () => void;
  onCheck: () => void;
  onReopen: () => void;
}) {
  const router = useRouter();
  const result = saved.result;
  const [pick, setPick] = useState<"a" | "b" | null>(() => {
    if (saved.kept === "a" || saved.kept === "b") return saved.kept;
    if (!saved.result) return null;
    const rec = settle(settleFork(saved)).rec;
    return rec.hold || !rec.path ? null : rec.path;
  });
  const [lookNote, setLookNote] = useState<string | null>(null);
  if (!result) return null;
  const care = sensitiveOf(saved.decision);
  const kept = saved.kept;
  const plan = settle(settleFork(saved));

  if (care) {
    return (
      <Shell
        step={STEP_LABEL.card}
        action={<NextButton onClick={() => router.push("/")}>Home</NextButton>}
      >
        <Title sub="Other people's experiences. Not advice." pet="owl">
          {saved.decision}
        </Title>
        <p className="shrink-0 text-lg font-semibold text-balance">
          Take what they wish they’d known to someone who does this for a
          living.
        </p>
        <WishPager wish={wishOf(result)} />
        <p className="shrink-0 text-xs text-muted-foreground">
          Other people’s experiences. Not advice.
        </p>
      </Shell>
    );
  }

  if (!kept && plan.rec.hold) {
    return (
      <Shell step={STEP_LABEL.card} action={<NextButton onClick={onCheck}>Check it</NextButton>}>
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto [scrollbar-width:none]">
          <SettleRead saved={saved} pathA={result.pathA} pathB={result.pathB} />
        </div>
      </Shell>
    );
  }

  if (!kept) {
    const take =
      pick != null && pick === plan.rec.path && plan.rec.next === "The coin is theater. Take it and stop.";
    return (
      <Shell
        step={STEP_LABEL.card}
        action={
          pick ? (
            <NextButton onClick={() => onPick(pick)}>
              {take ? "Take it and stop" : "This one"}
            </NextButton>
          ) : (
            <NextButton disabled onClick={() => {}}>
              Pick one
            </NextButton>
          )
        }
      >
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto [scrollbar-width:none]">
          <SettleRead saved={saved} pathA={result.pathA} pathB={result.pathB} />
          <div className="flex shrink-0 flex-col gap-2.5">
            {(["a", "b"] as const).map((key) => {
              const meter = result.meter[key];
              return (
                <Raised key={key} late={key === "b"}>
                  <Pick pressed={pick === key} onClick={() => setPick(key)}>
                    <span className="flex items-center gap-3">
                      <Pet kind={key === "a" ? "cat" : "duck"} size={40} mood={pick === key ? "hop" : "idle"} />
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <Fit max={18} min={13} lines={2} className="font-semibold">
                          {key === "a" ? result.pathA : result.pathB}
                        </Fit>
                        {reported(meter) === 0 ? (
                          <span className="text-sm text-muted-foreground">No posts about this yet.</span>
                        ) : (
                          <Counts meter={meter} />
                        )}
                      </span>
                    </span>
                  </Pick>
                </Raised>
              );
            })}
          </div>
        </div>
      </Shell>
    );
  }

  const clash = mustVsCrowd(saved, result, kept);
  const unknown = unknownOf(saved, result);
  function again() {
    if ((saved.refreshes ?? 0) >= 2) {
      setLookNote("The record is unchanged.");
      return;
    }
    const why = saved.reasons?.trim();
    if (why && lookNote !== why) {
      setLookNote(why);
      return;
    }
    onLook();
  }

  return (
    <Shell
      step={STEP_LABEL.card}
      action={<NextButton onClick={onLeave}>I’m done</NextButton>}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto [scrollbar-width:none]">
        <SettleRead saved={saved} pathA={result.pathA} pathB={result.pathB} />
        {clash ? (
          <Bubble from="ffomo">
            <p className="text-pretty">{clash}</p>
          </Bubble>
        ) : null}
        {unknown ? <p className="px-1 text-xs text-pretty text-muted-foreground">Still unknown. {unknown}</p> : null}
        {!saved.reasons ? (
          <Bubble from="ffomo">
            <p>Write one sentence. That’s what shows up if the other one comes back.</p>
          </Bubble>
        ) : null}
        {lookNote === "The record is unchanged." ? (
          <Bubble from="ffomo">
            <p>The record is unchanged.</p>
          </Bubble>
        ) : null}
      </div>
      <div className="grid shrink-0 grid-cols-3 gap-2">
        <button
          type="button"
          data-slot="button"
          className={SMALL}
          onClick={onReopen}
        >
          Other one
        </button>
        <button type="button" data-slot="button" className={SMALL} onClick={onReasons}>
          {saved.reasons ? "Why" : "Write why"}
        </button>
        <button type="button" data-slot="button" className={SMALL} onClick={again}>
          {(saved.refreshes ?? 0) >= 2 ? "Unchanged" : lookNote && lookNote !== "The record is unchanged." ? "Look anyway" : "Look again"}
        </button>
      </div>
    </Shell>
  );
}

export function ReasonsScreen({
  reasons,
  intent,
  note,
  onSave,
}: {
  reasons?: string;
  intent: "why" | "changed" | "edit";
  note?: string;
  onSave: (reasons: string) => void;
}) {
  const [text, setText] = useState(reasons ?? "");
  const trimmed = text.trim();
  const ready = trimmed.length >= 12;
  const changed = intent === "changed";
  return (
    <Shell
      step={changed ? "The other one" : STEP_LABEL.reasons}
      action={
        <NextButton disabled={!ready} onClick={() => onSave(trimmed)}>
          {changed ? "Open it" : intent === "edit" ? "Save" : "This one"}
        </NextButton>
      }
    >
      <Title
        sub={
          changed
            ? "One sentence, or it stays closed."
            : "One sentence. Then the other one stays closed."
        }
        pet="cat"
        mood={ready ? "look" : "idle"}
      >
        {changed ? "What changed?" : "Why this one?"}
      </Title>
      {note ? <p className="shrink-0 text-sm text-pretty text-muted-foreground">{note}</p> : null}
      {trimmed.length > 0 && !ready ? (
        <p className="shrink-0 text-sm text-muted-foreground">A bit longer.</p>
      ) : null}
      <label className="flex min-h-0 flex-1 flex-col">
        <span className="sr-only">Your reasons</span>
        <Textarea
          value={text}
          maxLength={500}
          onChange={(event) => setText(event.target.value)}
          className="h-full min-h-0 flex-1 rounded-2xl p-4 text-base md:text-base"
        />
      </label>
    </Shell>
  );
}

