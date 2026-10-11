import assert from "node:assert/strict";
import { verdictFrom, type FaceScore } from "./gut.ts";

const frames = (score: FaceScore) => [score, score, score, score];
const rest: FaceScore = { smile: 0.42, frown: 0.18, confused: 0.1 };

// A frown with no smile rise is no smile.
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
console.log("gut ok");
