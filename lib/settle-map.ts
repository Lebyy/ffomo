import type { GutRecord } from "@/lib/flow";
import type { DecideResult, Story } from "@/lib/schema";
import type { SavedDecision } from "@/lib/store";
import type { SettleFork, SettleGut, SettleRecord } from "@/lib/settle";

const meter = { glad: 0, regret: 0, mixed: 0, unclear: 0, strength: 1 as const };

export function thinResult(pathA: string, pathB: string): DecideResult {
  return {
    pathA,
    pathB,
    stories: [],
    wish: [],
    futureA: [],
    futureB: [],
    meter: { a: { ...meter }, b: { ...meter } },
  };
}

function fearText(saved: SavedDecision) {
  const note = saved.fearNote?.trim() || saved.fearLine?.trim();
  if (note) return note;
  if (saved.fear === "fact") return "a missing fact";
  if (saved.fear === "money") return "the money";
  if (saved.fear === "others") return "other people";
  if (saved.fear === "later") return "how long it will feel";
  if (saved.fear === "want") return "what i want";
  return "";
}

function gutOf(gut?: GutRecord): SettleGut | null {
  if (!gut) return null;
  if (gut.ignored) return { coin: gut.path, reaction: "nothing", latencyMs: gut.latencyMs };
  const reaction =
    gut.felt === "relieved" ? "relief" : gut.felt === "disappointed" ? "dread" : "nothing";
  return { coin: gut.path, reaction, latencyMs: gut.latencyMs };
}

function toRecord(story: Story): SettleRecord[] {
  if (story.kind === "sketch") return [];
  if (story.feeling !== "glad" && story.feeling !== "regret" && story.feeling !== "mixed")
    return [];
  return [
    {
      path: story.path,
      stance: story.feeling,
      ...(story.monthsLater != null ? { monthsLater: story.monthsLater } : {}),
    },
  ];
}

export function settleFork(saved: SavedDecision): SettleFork {
  const marks = saved.mustMarks ?? [];
  const hasNumbers =
    saved.paid != null || saved.recoverable != null || saved.extra != null;
  return {
    mode: saved.when === "already" ? "rescue" : "decide",
    fearText: fearText(saved),
    urgent: Boolean(saved.urgent),
    size: saved.size === "small" ? "small" : "big",
    undo: saved.undo ?? "hard",
    taken: saved.when === "already" ? "a" : undefined,
    binding: saved.binding ?? { on: false, checked: false },
    resolving: saved.resolving ?? { applies: false, checked: false, inHand: false },
    numbers: hasNumbers
      ? { paid: saved.paid, recoverable: saved.recoverable, extra: saved.extra }
      : null,
    musts: (saved.musts ?? []).map((text, index) => ({
      text,
      a: Boolean(marks[index]?.a),
      b: Boolean(marks[index]?.b),
    })),
    gut: gutOf(saved.gut),
    records: (saved.result?.stories ?? []).flatMap(toRecord),
    opens: saved.opens ?? 0,
    refreshes: saved.refreshes ?? 0,
    challenges: saved.challenges ?? 0,
    locked: Boolean(saved.kept),
    reason: saved.reasons ?? "",
  };
}
