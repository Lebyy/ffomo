// SETTLE, from "A Kiss, Not an Assay" (11 Oct 2026).
// The weights are the paper's design constants. They are not a fit, and they are not a scan.

export type Mode = "decide" | "rescue";
export type Size = "small" | "big";
export type Undo = "easy" | "hard";
export type Cause = "fact" | "money" | "door" | "others" | "later" | "want" | "best";
export type PathId = "a" | "b";
export type Stance = "glad" | "regret" | "mixed";
export type Treatment =
  | "FACT"
  | "RECONSIDER"
  | "GOOD-ENOUGH"
  | "EVIDENCE"
  | "GUT"
  | "COMMITMENT";
export type Phase = "name" | "facts" | "sides" | "must" | "gut" | "card" | "lock" | "check";
export type Band = "loud" | "restless" | "quiet";
export type ControlBand = "captured" | "returning" | "re-engaged";
export type CheckMove = "yours" | "quieter" | "louder" | "same";

export type SettleRecord = {
  path: PathId;
  stance: Stance;
  monthsLater?: number;
};

export type SettleMust = { text: string; a: boolean; b: boolean };

export type SettleNumbers = {
  paid?: number;
  recoverable?: number;
  extra?: number;
};

export type SettleGut = {
  coin?: PathId;
  reaction?: "relief" | "dread" | "nothing";
  latencyMs?: number;
};

export type SettleFork = {
  mode: Mode;
  fearText: string;
  urgent: boolean;
  size: Size;
  undo: Undo;
  taken?: PathId;
  binding: { on: boolean; checked: boolean; survives?: PathId };
  resolving: { applies: boolean; checked: boolean; inHand: boolean };
  numbers: SettleNumbers | null;
  musts: SettleMust[];
  gut: SettleGut | null;
  records: SettleRecord[];
  opens: number;
  refreshes: number;
  challenges: number;
  locked: boolean;
  reason: string;
};

export type Alarm = {
  threat: number;
  volatility: number;
  control: number;
  stress: number;
  alarm: number;
  band: Band;
  controlBand: ControlBand;
};

export type Recommendation = {
  path: PathId | null;
  treatment: Treatment;
  disagree: boolean;
  /** True when a fact is still unchecked. Nothing soothing runs yet. */
  hold: boolean;
  next: string;
  counts?: { a: { n: number; glad: number }; b: { n: number; glad: number } };
};

export type SettlePlan = {
  cause: Cause;
  score: Alarm;
  phases: Phase[];
  draft: boolean;
  lockDays: 0 | 7 | 30;
  rec: Recommendation;
  fade: { closed: number[]; open: number[] };
  interrupt: boolean;
  honesty: { inventedStories: false; inventedNumbers: false };
};

const LEXICON: { cause: Cause; phrases: string[] }[] = [
  { cause: "fact", phrases: ["fact", "deadline", "hardware", "spec", "missing"] },
  { cause: "money", phrases: ["money", "price", "cost", "pay", "paid", "afford"] },
  { cause: "door", phrases: ["open door", "left open", "reopen", "switch back"] },
  { cause: "others", phrases: ["everyone", "other people", "happier", "friends"] },
  { cause: "later", phrases: ["how long", "feel later", "for weeks", "fade"] },
  { cause: "want", phrases: ["what i want", "don't know what i want", "not sure what i want"] },
  { cause: "best", phrases: ["the best", "wrong life", "wanting the best", "perfect"] },
];

export const CAUSE_LINE: Record<Cause, string> = {
  fact: "Missing a fact.",
  money: "The money.",
  door: "The door left open.",
  others: "Other people.",
  later: "How long it will feel.",
  want: "Not knowing what you want.",
  best: "Wanting the best.",
};

export const CHECK_LINE: Record<CheckMove, string> = {
  yours: "This number is yours. The line before it is still a guess.",
  quieter: "Quieter. That usually happens when you leave the other one alone.",
  louder: "Louder. That usually means you opened the other one again. A real rise stays.",
  same: "About the same. Looking again won't change it.",
};

export const FADE_CLOSED = [1, 0.62, 0.38, 0.18] as const;
export const FADE_OPEN = [1, 0.9, 0.78, 0.64] as const;
export const FADE_WHEN = ["Now", "1 week", "1 month", "6 months"] as const;

function clamp(n: number) {
  return Math.min(100, Math.max(0, Math.round(n)));
}

function hits(text: string, phrase: string) {
  const hay = text.toLowerCase();
  if (phrase.includes(" ")) return hay.split(phrase).length - 1;
  return hay.match(new RegExp(`\\b${phrase}\\b`, "g"))?.length ?? 0;
}

// Tie-break order is the lexicon order. A missing fact is the cheapest alarm to end.
export function classify(fearText: string, mode: Mode): Cause {
  const text = fearText.trim();
  if (!text) return mode === "rescue" ? "door" : "best";
  let best: { cause: Cause; n: number } | null = null;
  for (const row of LEXICON) {
    const n = row.phrases.reduce((sum, phrase) => sum + hits(text, phrase), 0);
    if (n > 0 && (!best || n > best.n)) best = { cause: row.cause, n };
  }
  return best?.cause ?? (mode === "rescue" ? "door" : "best");
}

export function numbersSupplied(numbers: SettleNumbers | null) {
  if (!numbers) return false;
  return [numbers.paid, numbers.recoverable, numbers.extra].some(
    (n) => typeof n === "number" && Number.isFinite(n),
  );
}

export function switchCost(numbers: SettleNumbers | null) {
  if (!numbersSupplied(numbers) || !numbers) return null;
  const paid = numbers.paid ?? 0;
  const recoverable = numbers.recoverable ?? 0;
  const extra = numbers.extra ?? 0;
  return Math.max(0, paid - recoverable) + Math.max(0, extra);
}

function cheapExit(fork: SettleFork) {
  const paid = fork.numbers?.paid;
  const cost = switchCost(fork.numbers);
  return paid != null && paid >= 0 && cost != null && cost <= paid * 0.15;
}

function costlyExit(fork: SettleFork) {
  const paid = fork.numbers?.paid;
  const cost = switchCost(fork.numbers);
  return paid != null && cost != null && cost > paid * 0.15;
}

function earlyShare(records: SettleRecord[]) {
  if (records.length === 0) return 0;
  const early = records.filter((row) => row.monthsLater != null && row.monthsLater < 1).length;
  return early / records.length;
}

export function scoreAlarm(fork: SettleFork, cause: Cause): Alarm {
  const rescue = fork.mode === "rescue";
  const inHand = fork.resolving.inHand;
  let fact = 0;
  if (inHand) fact = -18;
  else if (fork.resolving.applies && !fork.resolving.checked) fact = 34 + (rescue ? 14 : 0);
  else if (fork.resolving.applies && fork.resolving.checked) fact = 22;

  const threat = clamp(
    20 +
      fact +
      (fork.locked ? -16 : 18) +
      Math.min(24, 6 * fork.opens) +
      Math.min(16, 8 * fork.challenges) +
      (cause === "others" ? 10 : 0),
  );

  const volatility = clamp(
    10 +
      Math.min(56, 18 * fork.refreshes) +
      Math.min(18, 4 * fork.opens) +
      Math.round(16 * earlyShare(fork.records)) -
      (fork.locked ? 18 : 0),
  );

  const named = fork.musts.filter((item) => item.text.trim().length > 0);
  const line = named.length >= 3 ? 16 : 0;
  const checked = named.length >= 3 && named.some((item) => item.a || item.b) ? 8 : 0;
  const control = clamp(
    6 +
      (fork.fearText.trim().length >= 8 ? 22 : 0) +
      line +
      checked +
      (fork.gut ? 16 : 0) +
      (fork.reason.trim().length >= 12 ? 14 : 0) +
      (fork.locked ? 12 : 0),
  );

  let money = 0;
  if (numbersSupplied(fork.numbers)) money = -10;
  else if (cause === "money" || rescue) money = 12;

  const stress = clamp(
    14 +
      (rescue ? 14 : 0) +
      money +
      (fork.urgent ? 12 : 0) +
      (rescue && !fork.locked ? 10 : 0) +
      (inHand ? -14 : 0),
  );

  const alarm = clamp(
    0.48 * threat + 0.16 * volatility + 0.2 * stress + 0.16 * (100 - control),
  );
  return {
    threat,
    volatility,
    control,
    stress,
    alarm,
    band: bandOf(alarm),
    controlBand: controlOf(control),
  };
}

export function bandOf(n: number): Band {
  if (n >= 55) return "loud";
  if (n >= 32) return "restless";
  return "quiet";
}

export function controlOf(n: number): ControlBand {
  if (n >= 68) return "re-engaged";
  if (n >= 40) return "returning";
  return "captured";
}

export function crowdWord(glad: number, regret: number, mixed = 0) {
  const n = glad + regret + mixed;
  if (n < 5) return null;
  if (glad / n >= 0.6) return "Most were glad.";
  if (regret / n >= 0.6) return "Most regretted it.";
  if (mixed / n >= 0.6) return "Most were mixed.";
  return null;
}

export function sideOf(records: SettleRecord[], path: PathId) {
  const rows = records.filter((row) => row.path === path);
  const n = rows.length;
  const glad = rows.filter((row) => row.stance === "glad").length;
  const regret = rows.filter((row) => row.stance === "regret").length;
  const mixed = rows.filter((row) => row.stance === "mixed").length;
  const stance: Stance | null =
    n > 0 && glad / n >= 0.6 ? "glad" : n > 0 && regret / n >= 0.6 ? "regret" : n > 0 && mixed / n >= 0.6 ? "mixed" : null;
  const loud = n >= 5 && stance != null;
  return { n, glad, regret, mixed, gladRate: n === 0 ? 0 : glad / n, stance, loud, most: loud };
}

function meetsAll(musts: SettleMust[], path: PathId) {
  const named = musts.filter((item) => item.text.trim());
  return named.length >= 3 && named.every((item) => item[path]);
}

export function strongPath(gut: SettleGut | null): PathId | null {
  if (!gut?.coin || !gut.reaction || gut.reaction === "nothing") return null;
  if (gut.latencyMs == null || gut.latencyMs > 4000) return null;
  if (gut.reaction === "relief") return gut.coin;
  return gut.coin === "a" ? "b" : "a";
}

function takenOrA(fork: SettleFork): PathId {
  return fork.taken ?? "a";
}

function withDisagree(
  fork: SettleFork,
  rec: Omit<Recommendation, "disagree" | "hold"> & { hold?: boolean },
): Recommendation {
  const gut = strongPath(fork.gut);
  return { hold: false, ...rec, disagree: gut != null && gut !== rec.path };
}

export function recommend(fork: SettleFork): Recommendation {
  if (fork.binding.on && !fork.binding.checked) {
    return withDisagree(fork, {
      path: takenOrA(fork),
      treatment: "FACT",
      hold: true,
      next: "Check it before you decide.",
    });
  }
  if (fork.binding.on && fork.binding.checked && fork.binding.survives) {
    return withDisagree(fork, {
      path: fork.binding.survives,
      treatment: "FACT",
      next: "That fact decides it.",
    });
  }
  if (fork.resolving.applies && fork.resolving.inHand) {
    return withDisagree(fork, {
      path: takenOrA(fork),
      treatment: "FACT",
      next: "You already have the fact.",
    });
  }
  if (fork.resolving.applies && !fork.resolving.checked) {
    return withDisagree(fork, {
      path: takenOrA(fork),
      treatment: "FACT",
      hold: true,
      next: "Check it before you decide.",
    });
  }

  const a = sideOf(fork.records, "a");
  const b = sideOf(fork.records, "b");
  if (
    fork.mode === "rescue" &&
    fork.taken &&
    a.loud &&
    b.loud &&
    sideOf(fork.records, fork.taken).stance === "regret" &&
    sideOf(fork.records, fork.taken === "a" ? "b" : "a").stance === "glad" &&
    cheapExit(fork)
  ) {
    const other: PathId = fork.taken === "a" ? "b" : "a";
    return withDisagree(fork, {
      path: other,
      treatment: "RECONSIDER",
      next: "The later posts point there, and leaving is cheap.",
    });
  }

  const aMeets = meetsAll(fork.musts, "a");
  const bMeets = meetsAll(fork.musts, "b");
  if (aMeets !== bMeets) {
    return withDisagree(fork, {
      path: aMeets ? "a" : "b",
      treatment: "GOOD-ENOUGH",
      next: "It meets your three.",
    });
  }

  if (fork.size === "small" && fork.undo === "easy") {
    const gut = strongPath(fork.gut);
    if (gut) {
      return { path: gut, treatment: "GUT", hold: false, disagree: false, next: "Your reaction picked this. The coin is theater." };
    }
    return {
      path: fork.gut?.coin ?? "a",
      treatment: "COMMITMENT",
      hold: false,
      disagree: false,
      next: "The coin is theater. Take it and stop.",
    };
  }

  if (a.n >= 5 && b.n >= 5 && Math.abs(a.gladRate - b.gladRate) >= 0.25) {
    const gladder: PathId = a.gladRate > b.gladRate ? "a" : "b";
    const blocked =
      fork.mode === "rescue" && fork.taken != null && gladder !== fork.taken && costlyExit(fork);
    if (!blocked) {
      return withDisagree(fork, {
        path: gladder,
        treatment: "EVIDENCE",
        next: `${a.glad} of ${a.n} were glad on one side. ${b.glad} of ${b.n} on the other. People who posted are a selected sample.`,
        counts: { a: { n: a.n, glad: a.glad }, b: { n: b.n, glad: b.glad } },
      });
    }
  }

  if (fork.mode === "rescue" && fork.taken) {
    const gut = strongPath(fork.gut);
    const agrees = gut === fork.taken;
    return {
      path: fork.taken,
      treatment: agrees ? "GUT" : "COMMITMENT",
      hold: false,
      disagree: gut != null && !agrees,
      next: agrees ? "Your reaction agrees. Close the other one." : "Close the door on the other one.",
    };
  }

  const gut = strongPath(fork.gut);
  if (gut) {
    return { path: gut, treatment: "GUT", hold: false, disagree: false, next: "Your reaction picked this. The coin is theater." };
  }

  if (aMeets && bMeets) {
    return withDisagree(fork, {
      path: fork.gut?.coin ?? null,
      treatment: "GOOD-ENOUGH",
      next: fork.gut?.coin ? "Both meet your three. The coin breaks the tie." : "Both meet your three.",
    });
  }

  return {
    path: null,
    treatment: "COMMITMENT",
    hold: false,
    disagree: false,
    next: "There is no best.",
  };
}

export function phasesOf(fork: Pick<SettleFork, "size" | "undo" | "binding" | "resolving" | "records">) {
  const factsApply = fork.binding.on || fork.resolving.applies;
  const hasRecords = fork.records.length > 0;
  if (fork.size === "small" && fork.undo === "easy") {
    return { phases: ["gut", "card"] as Phase[], draft: false, lockDays: 0 as const };
  }
  const phases: Phase[] = ["name"];
  if (factsApply) phases.push("facts");
  if (hasRecords) phases.push("sides");
  if (fork.size === "big") phases.push("must");
  phases.push("gut", "card");
  return { phases, draft: false, lockDays: 0 as const };
}

export function fadeOf(alarm: number) {
  return {
    closed: FADE_CLOSED.map((m) => clamp(alarm * m)),
    open: FADE_OPEN.map((m) => clamp(alarm * m)),
  };
}

export function checkMove(prev: number | null, next: number): CheckMove {
  if (prev == null) return "yours";
  if (next < prev - 3) return "quieter";
  if (next > prev + 3) return "louder";
  return "same";
}

export function orderNote(mode: Mode, path: PathId, taken?: PathId) {
  if (mode === "rescue" && taken && path === taken) return "This side leads with later gladness.";
  if (mode === "rescue" && taken && path !== taken) return "This side leads with later regret.";
  return "Longest time first. A first-week post is the highlight reel.";
}

export function orderSide<T extends { stance: string; monthsLater?: number }>(
  stories: T[],
  mode: Mode,
  path: PathId,
  taken?: PathId,
) {
  const months = (row: T) => row.monthsLater ?? -1;
  const rank =
    mode === "rescue" && taken && path === taken
      ? (row: T) => (row.stance === "glad" ? 0 : row.stance === "mixed" ? 1 : 2)
      : mode === "rescue" && taken && path !== taken
        ? (row: T) => (row.stance === "regret" ? 0 : row.stance === "mixed" ? 1 : 2)
        : () => 0;
  return stories.toSorted((x, y) => rank(x) - rank(y) || months(y) - months(x));
}

// First look shows three when there are more. One more look shows the rest. The third identical look is blocked.
export function visibleCount(total: number, refreshes: number) {
  const blocked = refreshes >= 2;
  if (blocked) return { show: Math.min(3, total), blocked: true };
  if (refreshes === 0 && total > 3) return { show: 3, blocked: false };
  return { show: total, blocked: false };
}

export function settle(fork: SettleFork): SettlePlan {
  const cause = classify(fork.fearText, fork.mode);
  const score = scoreAlarm(fork, cause);
  const plan = phasesOf(fork);
  return {
    cause,
    score,
    phases: plan.phases,
    draft: plan.draft,
    lockDays: plan.lockDays,
    rec: recommend(fork),
    fade: fadeOf(score.alarm),
    interrupt: fork.refreshes >= 2,
    honesty: { inventedStories: false, inventedNumbers: false },
  };
}
