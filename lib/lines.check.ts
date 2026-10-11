import assert from "node:assert/strict";
import { cited, freshStories, pickStories, sourced, storyOf } from "./lines.ts";

assert.deepEqual(storyOf("* **B** ; regret ; 3 ; Went back because the phone felt laggy. [2]"), {
  path: "b",
  feeling: "regret",
  monthsLater: 3,
  text: "Went back because the phone felt laggy.",
});
assert.equal(storyOf("A ; glad ; ? ; Loves the new screen and battery.")?.monthsLater, undefined);
assert.equal(storyOf("Here is what I found:"), null);
{
  const seen = new Set<string>();
  const partial = "A ; glad ; 2 ; The battery still lasts two days";
  assert.equal(freshStories(partial, seen).length, 0);
  const first = freshStories(`${partial}.\nB ; regret ; 8 ; The commute got old fast`, seen);
  assert.equal(first.length, 1);
  assert.equal(first[0]?.path, "a");
  assert.equal(freshStories(`${partial}.\nB ; regret ; 8 ; The commute got old fast.\n`, seen).length, 1);
  assert.equal(freshStories(`${partial}.\n`, seen, true).length, 0);
}

const text = [
  "Here is what I found:",
  "A ; glad ; 14 ; Switched and the battery lasted two days.",
  "B ; regret ; 1 ; Stayed and still misses the bigger screen.",
  "A ; mixed ; ? ; This line has no source at all in search.",
  "B ; glad ; 6 ; Stayed and saved the money for a trip.",
].join("\n");
const chunks = [
  { url: "https://g/1", site: "reddit.com" },
  { url: "https://g/2", site: "macrumors.com" },
];
const supports = [
  { segment: { text: "Switched and the battery lasted two days." }, groundingChunkIndices: [0] },
  { segment: { text: "Stayed and still misses the bigger screen." }, groundingChunkIndices: [0, 1] },
  { segment: { text: "Stayed and saved the money for a trip." }, groundingChunkIndices: [1] },
];
const stories = pickStories(sourced(text, chunks, supports));
assert.deepEqual(
  stories.map((story) => [story.path, story.url]),
  [
    ["a", "https://g/1"],
    ["b", "https://g/2"],
  ],
);
const oai = [
  "A ; glad ; 2 ; Bought the 17 Pro and the camera was worth it. ([reddit.com](https://reddit.com/r/iphone/x?utm_source=openai))",
  "B ; regret ; ? ; Waited and paid more at launch.",
].join("\n");
const rows = cited(oai, [{ url: "https://reddit.com/r/iphone/x?utm_source=openai", start: 60, end: 120 }]);
assert.equal(rows[0].sources[0]?.site, "reddit.com");
assert.equal(rows[1].sources.length, 0);
assert.equal(storyOf(rows[0].line)?.text, "Bought the 17 Pro and the camera was worth it.");
assert.equal(pickStories(rows).length, 1);
console.log("lines ok");
