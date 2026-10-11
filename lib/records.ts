import { z } from "zod";
import { uniqueStories } from "./dedupe";
import { db } from "./mongo";
import type { DecideResult, Story } from "./schema";
import { storyStrength } from "./strength";

export const recordRequestSchema = z.object({
  id: z.string().trim().min(8).max(80),
  fork: z.string().trim().min(1).max(500),
  pathA: z.string().trim().min(1).max(80),
  pathB: z.string().trim().min(1).max(80),
  path: z.enum(["a", "b"]),
  when: z.enum(["1 week", "1 month", "6 months"]),
  feeling: z.enum(["glad", "regret", "same"]),
  words: z.string().trim().max(280).optional(),
  size: z.enum(["small", "big"]).optional(),
});

export type RecordRequest = z.infer<typeof recordRequestSchema>;

type CheckRow = {
  label: RecordRequest["when"];
  feeling: RecordRequest["feeling"];
  words?: string;
  at: number;
};

type Outcome = {
  _id: string;
  fork: string;
  pathA: string;
  pathB: string;
  path: "a" | "b";
  size?: "small" | "big";
  shared: true;
  checks: CheckRow[];
  at: number;
};

function monthsOf(label: CheckRow["label"]) {
  if (label === "6 months") return 6;
  if (label === "1 month") return 1;
  return 0;
}

function feelingOf(feeling: CheckRow["feeling"]): Story["feeling"] {
  if (feeling === "glad") return "glad";
  if (feeling === "regret") return "regret";
  return "mixed";
}

export function storyFromCheck(
  row: Outcome,
  check: CheckRow,
  paths?: { a?: string; b?: string },
): Story {
  const pathName = row.path === "b" ? (paths?.b ?? row.pathB) : (paths?.a ?? row.pathA);
  const words = check.words?.trim() || `Kept ${pathName}.`;
  const monthsLater = monthsOf(check.label);
  return {
    path: row.path,
    text: words.slice(0, 400),
    feeling: feelingOf(check.feeling),
    monthsLater,
    strength: storyStrength(monthsLater),
    fit: "close",
    kind: "check-in",
  };
}

function tally(stories: Story[], path: "a" | "b") {
  const side = stories.filter((story) => story.path === path);
  return {
    glad: side.filter((story) => story.feeling === "glad").length,
    regret: side.filter((story) => story.feeling === "regret").length,
    mixed: side.filter((story) => story.feeling === "mixed").length,
    unclear: side.filter((story) => story.feeling === "unclear").length,
    strength: side.reduce((sum, story) => sum + story.strength, 0),
  };
}

export function mixRecords(result: DecideResult, ours: Story[]): DecideResult {
  if (ours.length === 0) return result;
  const stories = uniqueStories([...ours, ...result.stories]);
  return {
    ...result,
    stories,
    meter: { a: tally(stories, "a"), b: tally(stories, "b") },
  };
}

function wordsOf(text: string) {
  return [...new Set(text.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 3))].slice(
    0,
    6,
  );
}

export async function saveRecord(body: RecordRequest) {
  const database = await db();
  if (!database) return false;
  const col = database.collection("outcomes");
  const prev = (await col.findOne({ _id: body.id } as never)) as Outcome | null;
  const check: CheckRow = {
    label: body.when,
    feeling: body.feeling,
    ...(body.words ? { words: body.words } : {}),
    at: Date.now(),
  };
  const checks = (prev?.checks ?? []).filter((row) => row.label !== body.when);
  checks.push(check);
  await col.replaceOne(
    { _id: body.id } as never,
    {
      _id: body.id,
      fork: body.fork,
      pathA: body.pathA,
      pathB: body.pathB,
      path: body.path,
      ...(body.size ? { size: body.size } : {}),
      shared: true,
      checks,
      at: Date.now(),
    },
    { upsert: true },
  );
  return true;
}

export async function findRecords(fork: string, pathA?: string, pathB?: string) {
  const database = await db();
  if (!database) return [] as Story[];
  const col = database.collection("outcomes");
  await col.createIndex({ fork: "text", pathA: "text", pathB: "text" });
  let rows: Outcome[] = [];
  try {
    rows = (await col
      .find({ $text: { $search: fork }, shared: true })
      .limit(12)
      .toArray()) as unknown as Outcome[];
  } catch {
    rows = [];
  }
  if (rows.length === 0) {
    const words = wordsOf([fork, pathA, pathB].filter(Boolean).join(" "));
    if (words.length === 0) return [];
    rows = (await col
      .find({
        shared: true,
        $or: words.map((word) => ({
          fork: { $regex: word, $options: "i" },
        })),
      })
      .limit(12)
      .toArray()) as unknown as Outcome[];
  }
  const paths = { a: pathA, b: pathB };
  return rows.flatMap((row) =>
    row.checks.map((check) => storyFromCheck(row, check, paths)),
  );
}
