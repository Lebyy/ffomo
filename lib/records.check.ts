import assert from "node:assert/strict";
import { uniqueStories } from "./dedupe.ts";
import { storyStrength } from "./strength.ts";

function storyFromCheck(
  path: "a" | "b",
  pathName: string,
  label: "1 week" | "1 month" | "6 months",
  feeling: "glad" | "regret" | "same",
  words?: string,
) {
  const monthsLater = label === "6 months" ? 6 : label === "1 month" ? 1 : 0;
  return {
    path,
    text: (words?.trim() || `Kept ${pathName}.`).slice(0, 400),
    feeling: feeling === "same" ? ("mixed" as const) : feeling,
    monthsLater,
    strength: storyStrength(monthsLater),
    fit: "close" as const,
    kind: "check-in" as const,
  };
}

const story = storyFromCheck(
  "a",
  "This white t-shirt",
  "1 month",
  "glad",
  "Still wear it most days.",
);
assert.equal(story.kind, "check-in");
assert.equal(story.feeling, "glad");
assert.equal(story.monthsLater, 1);
assert.equal(story.strength, 2);
assert.equal(story.text, "Still wear it most days.");

const same = storyFromCheck("b", "Go", "1 week", "same");
assert.equal(same.feeling, "mixed");
assert.equal(same.strength, 1);
assert.equal(same.text, "Kept Go.");

const mixed = uniqueStories([
  story,
  {
    path: "a" as const,
    text: "I stayed and rent hurt.",
    url: "https://reddit.com/r/x",
    feeling: "regret" as const,
    strength: 1 as const,
  },
]);
assert.equal(mixed[0]?.kind, "check-in");
assert.equal(mixed.length, 2);
