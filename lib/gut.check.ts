import assert from "node:assert/strict";
import { scoreFromLogits, verdictFrom, type FaceScore } from "./gut.ts";

const frames = (score: FaceScore) => [score, score, score, score];
const rest: FaceScore = { smile: 0.42, frown: 0.18, confused: 0.1 };

// Blendshapes. A frown with no smile rise is no smile.
assert.equal(verdictFrom(rest, frames({ smile: 0.48, frown: 0.55, confused: 0.1 })), "none");
// A high smile that never rose is still no smile.
assert.equal(verdictFrom(rest, frames({ smile: 0.5, frown: 0.2, confused: 0.1 })), "none");
// A real rise over the window is a smile.
assert.equal(
  verdictFrom({ smile: 0.2, frown: 0.1, confused: 0.1 }, frames({ smile: 0.72, frown: 0.12, confused: 0.1 })),
  "smile",
);
// A pressed or puckered mouth with no smile is the unsure look.
assert.equal(verdictFrom(rest, frames({ smile: 0.42, frown: 0.2, confused: 0.5 })), "confused");
// No baseline or too few frames means nothing to read.
assert.equal(verdictFrom(null, frames(rest)), "noface");
assert.equal(verdictFrom(rest, []), "noface");

const prior: FaceScore = { smile: 0.12, frown: 0.12, confused: 0.08, kind: "feel" };
// Sadness plus a negative valence is not a smile, even if happiness twitches.
const frown = scoreFromLogits([0, 1, 0, 0, 1.2, 0, 2.2, 0, -0.35, 0]);
assert.ok(frown);
assert.equal(verdictFrom(prior, frames(frown)), "none");
// Happiness is a smile, with or without a saved baseline.
const glad = scoreFromLogits([0, 0, 0, 0, 5, 0, 0, 0, 0.6, 0]);
assert.ok(glad);
assert.equal(verdictFrom(prior, frames(glad)), "smile");
assert.equal(verdictFrom(null, frames(glad)), "smile");
// A resting feel score is not a smile just because there is no baseline.
assert.equal(
  verdictFrom(null, frames({ smile: 0.4, frown: 0.12, confused: 0.08, kind: "feel" })),
  "none",
);
// Fear, not happiness, is the unsure look.
const unsure = scoreFromLogits([0, 0, 0, 5, 0, 0, 0, 0, 0, 0.2]);
assert.ok(unsure);
assert.equal(verdictFrom(prior, frames(unsure)), "confused");
console.log("gut ok");
