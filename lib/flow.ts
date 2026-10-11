export type Fear = "fact" | "others" | "money" | "want" | "later";

export type Step =
  | "facts"
  | "sides"
  | "fear"
  | "cost"
  | "must"
  | "future"
  | "tryon"
  | "gut"
  | "card"
  | "reasons"
  | "lock"
  | "checks";

export type Cost = { keep: string; leave: string };

export type Felt =
  | "relieved"
  | "disappointed"
  | "nothing"
  | "unsure"
  | "unrelated";

export type GutRecord = {
  path: "a" | "b";
  line: string;
  ignored: boolean;
  still?: string;
  felt?: Felt;
  pulse?: { a: number | null; b: number | null };
  play?: Ritual;
};

export const FELT_LINE: Record<Felt, string> = {
  relieved: "Relieved it landed there.",
  disappointed: "Wished it landed on the other one.",
  nothing: "Neutral.",
  unsure: "Not sure yet. Still open.",
  unrelated: "Something else was on my mind.",
};

export const PLAYS = ["cards", "doors", "point", "pets"] as const;
export type Ritual = (typeof PLAYS)[number];

export type Lean = { path: "a" | "b"; why: string } | null;

// What they already did or what only one path meets beats a model read of their words.
export function knownLean(fork: {
  when: "not-yet" | "already";
  enoughPath?: "a" | "b" | "both" | "neither";
}): Lean {
  if (fork.when === "already") return { path: "a", why: "You already chose it." };
  if (fork.enoughPath === "a" || fork.enoughPath === "b")
    return { path: fork.enoughPath, why: "Only it met your three must-haves." };
  return null;
}

// A known lean lands there. Otherwise the coin flips, and it will not repeat the last side.
export function coinLand(lean: Lean, roll: number, last?: "a" | "b" | null): "a" | "b" {
  if (lean) return lean.path;
  const side: "a" | "b" = roll < 0.5 ? "a" : "b";
  if (!last || side !== last) return side;
  return side === "a" ? "b" : "a";
}

// Smile is per path, read while that path was on screen. The line stays an observation.
export function gutRead(
  read: { a: boolean; b: boolean; face: boolean },
  lean: Lean,
): { path: "a" | "b"; line: string } {
  const fallback = lean?.path ?? "a";
  if (!read.face) return { path: fallback, line: "Couldn't see a face." };
  if (read.a !== read.b) return { path: read.a ? "a" : "b", line: "You smiled." };
  return { path: fallback, line: read.a ? "You smiled." : "No smile." };
}

// Skips the plays this phone saw last, so a new decision gets a new one.
export function pickPlay(id: string, recent: readonly string[]): Ritual {
  const fresh = PLAYS.filter((play) => !recent.includes(play));
  const pool = fresh.length > 0 ? fresh : PLAYS;
  let n = 0;
  for (let i = 0; i < id.length; i++) n = (n * 31 + id.charCodeAt(i)) >>> 0;
  return pool[n % pool.length];
}

export type PulseReading = { at: number; bpm: number; confidence: number };

// Pulse is a 12-second average, so readings from the last 5 seconds of a
// window, plus 2 seconds of lag after it, describe that window.
export function pulseIn(readings: PulseReading[], end: number) {
  const inside = readings.filter(
    (r) => r.at > end - 5e6 && r.at <= end + 2e6 && r.confidence >= 20,
  );
  if (inside.length === 0) return null;
  return Math.round(inside.reduce((sum, r) => sum + r.bpm, 0) / inside.length);
}

export function pulseLine(
  pulse: GutRecord["pulse"],
  pathA: string,
  pathB: string,
) {
  if (!pulse) return "";
  if (pulse.a == null && pulse.b == null) return "Pulse didn't read.";
  const part = (n: number | null, name: string) =>
    n == null ? `no read on ${name}` : `${n} on ${name}`;
  return `Pulse ${part(pulse.a, pathA)}, ${part(pulse.b, pathB)}.`;
}

export type Check = {
  label: "1 week" | "1 month" | "6 months";
  due: number;
  feeling?: "glad" | "regret" | "same";
  note?: string;
};

export const FEARS: { id: Fear; label: string }[] = [
  { id: "fact", label: "A fact" },
  { id: "others", label: "What other people have" },
  { id: "money", label: "Money" },
  { id: "want", label: "Not knowing what I want" },
  { id: "later", label: "How it will feel later" },
];

export const STEP_LABEL: Record<Step, string> = {
  facts: "Check first",
  sides: "Both sides",
  fear: "The fear",
  cost: "The cost",
  must: "Must-haves",
  future: "Future you",
  tryon: "Try it on",
  gut: "Gut check",
  card: "The card",
  reasons: "Your reasons",
  lock: "Door closed",
  checks: "Check in",
};

export const LOCK_MS = 30 * 24 * 60 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

const SMALL =
  /\b(shirt|shirts|shoes|sneakers|jacket|dress|outfit|jeans|hat|bag|coat|glasses|lunch|dinner|coffee|color)\b/i;
const THING =
  /\b(shirt|shirts|shoes|sneakers|jacket|dress|outfit|jeans|hat|bag|coat|glasses|hoodie|sweater|boots|backpack|watch|headphones|earbuds|phone|iphone|laptop|ipad|bike|ring|necklace|perfume|camera|console|keyboard|sofa|desk|lamp|mug|cup)\b/i;

export type ForkInfo = {
  decision: string;
  when: "not-yet" | "already";
  fear?: Fear;
  size?: "small" | "big";
  thing?: boolean;
  photo?: boolean;
  facts?: number;
};

export function stakesOf(fork: Pick<ForkInfo, "decision" | "size">) {
  return fork.size ?? (SMALL.test(fork.decision) ? "small" : "big");
}

export function isThing(fork: Pick<ForkInfo, "decision" | "thing">) {
  return fork.thing ?? THING.test(fork.decision);
}

const CARE =
  /\b(medications?|medicine|meds|prescriptions?|dosage|dose|surgery|chemo(therapy)?|diagnos(?:is|e|ed)|antidepressants?|treatments?|therapy|therapist|vaccines?|ivf|rehab)\b|\b(stop|quit|quitting|stopping|come off|coming off|taper)\b.{0,20}\b(taking|pills?|drugs?|ssris?|insulin)\b/i;
const LEGAL =
  /\b(lawsuits?|sue|suing|custody|plea( deal)?|restraining order|lawyer|attorney|court|settlement|press charges)\b/i;
const INVEST =
  /\b(stocks?|crypto|bitcoin|portfolio|index funds?|etfs?|401\(?k\)?|roth|ira|retirement (fund|account|savings)|save or invest|invest or save|invest (my|our|the) (money|savings))\b/i;

export function sensitiveOf(decision: string) {
  if (CARE.test(decision)) return "care" as const;
  if (LEGAL.test(decision)) return "legal" as const;
  if (INVEST.test(decision)) return "invest" as const;
  return null;
}

export function reported(meter: {
  glad: number;
  regret: number;
  mixed?: number;
  unclear?: number;
}) {
  return meter.glad + meter.regret + (meter.mixed ?? 0) + (meter.unclear ?? 0);
}

export function meterReady(meter: {
  glad: number;
  regret: number;
  mixed?: number;
  unclear?: number;
}) {
  return reported(meter) >= 3;
}

export function disagree(
  a: { glad: number; regret: number; mixed?: number },
  b: { glad: number; regret: number; mixed?: number },
) {
  const ways = (meter: { glad: number; regret: number; mixed?: number }) =>
    [meter.glad, meter.regret, meter.mixed ?? 0].filter((n) => n > 0).length;
  return (
    ways(a) > 1 ||
    ways(b) > 1 ||
    (a.glad > 0 && b.regret > 0) ||
    (b.glad > 0 && a.regret > 0)
  );
}

export function stepsFor(fork: ForkInfo): Step[] {
  const big = stakesOf(fork) === "big";
  const first: Step[] = big || (fork.facts ?? 0) > 0 ? ["facts", "sides"] : ["sides"];
  if (sensitiveOf(fork.decision))
    return big ? [...first, "must", "card"] : [...first, "card"];
  const steps: Step[] = [...first];
  if (fork.fear === "money" || (big && fork.when === "already"))
    steps.push("cost");
  if (big) steps.push("must");
  if (big && fork.when === "not-yet" && fork.fear !== "want")
    steps.push("future");
  if (isThing(fork) && fork.photo) steps.push("tryon");
  steps.push("gut", "card");
  return steps;
}

export function nextStep(step: Step, fork: ForkInfo) {
  const steps = stepsFor(fork);
  const index = steps.indexOf(step);
  if (index < 0) return steps[1] ?? null;
  return steps[index + 1] ?? null;
}

// Screens off the main line (reasons, check-ins, the lock) return to the card.
export function prevStep(step: Step, fork: ForkInfo): Step | null {
  if (step === "reasons" || step === "checks") return "card";
  const steps = stepsFor(fork);
  const index = steps.indexOf(step);
  return index > 0 ? steps[index - 1] : null;
}

export function nextLabel(step: Step, fork: ForkInfo) {
  const next = nextStep(step, fork);
  if (next === "sides") return "See both";
  if (next === "gut") return "Gut check";
  if (next === "future") return "Future you";
  if (next === "tryon") return "Try it on";
  if (next === "card") return "The card";
  if (next === "cost") return "The cost";
  if (next === "must") return "Must-haves";
  return "Next";
}

export function progressOf(step: Step, fork: ForkInfo) {
  const steps = stepsFor(fork);
  const index = steps.indexOf(step);
  if (index < 0) return null;
  return (index + 1) / (steps.length + 1);
}

export function money(text: string) {
  const cleaned = text.replace(/,/g, "").trim();
  if (!cleaned) return null;
  const match = cleaned.match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const value = Number(match[0]);
  return Number.isFinite(value) ? value : null;
}

function show(value: number) {
  const digits = Number.isInteger(Math.round(value * 100) / 100) ? 0 : 2;
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: 2,
  });
}

// `other` names the second path before a choice; after one, it's the switch.
export function costLine(cost: Cost, other?: string) {
  const keep = money(cost.keep);
  const leave = money(cost.leave);
  if (keep == null || leave == null) return null;
  const diff = Math.round((leave - keep) * 100) / 100;
  if (diff === 0) return "Same cost either way.";
  const subject = other ?? "Switching";
  return `${subject} costs ${show(Math.abs(diff))} ${diff > 0 ? "more" : "less"}.`;
}

export function scheduleChecks(from: number): Check[] {
  return [
    { label: "1 week", due: from + 7 * DAY },
    { label: "1 month", due: from + 30 * DAY },
    { label: "6 months", due: from + 182 * DAY },
  ];
}

export function dueCheck(checks: Check[] | undefined, now: number) {
  return checks?.find((item) => !item.feeling && item.due <= now) ?? null;
}

export function isLocked(until: number | undefined, now: number) {
  return (until ?? 0) > now;
}

export function readNow() {
  return Date.now();
}

export function laterOnes<T extends { monthsLater?: number }>(stories: T[]) {
  const later = stories.filter((story) => (story.monthsLater ?? 0) >= 1);
  return later.length > 0 ? later : stories;
}

export function showGut(gut: GutRecord | undefined) {
  if (!gut) return false;
  if (gut.felt) return true;
  if (gut.line === "Camera stayed off.") return true;
  return !gut.ignored;
}

export function gutCopy(gut: GutRecord) {
  const felt = gut.felt ? FELT_LINE[gut.felt] : "";
  const showLine =
    gut.line && (gut.line === "Camera stayed off." || !gut.ignored);
  return [felt, showLine ? gut.line : ""].filter(Boolean).join(" ");
}
