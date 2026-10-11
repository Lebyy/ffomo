import assert from "node:assert/strict";
import { prevStep as prevOf } from "./flow.ts";

{
  const big = { decision: "Take the job in Austin or stay", when: "not-yet" as const, size: "big" as const };
  assert.equal(prevOf("facts", big), null);
  assert.equal(prevOf("sides", big), "facts");
  assert.equal(prevOf("card", big), "gut");
  assert.equal(prevOf("reasons", big), "card");
}
import {
  costLine,
  disagree,
  dueCheck,
  coinLand,
  gutCopy,
  gutRead,
  knownLean,
  isLocked,
  LOCK_MS,
  meterReady,
  nextStep,
  pickPlay,
  PLAYS,
  progressOf,
  pulseIn,
  pulseLine,
  reported,
  scheduleChecks,
  sensitiveOf,
  stakesOf,
  stepsFor,
} from "./flow.ts";

const phd = {
  decision: "Do phd or masters after my under grad",
  when: "not-yet" as const,
};

assert.equal(stakesOf({ decision: "Which shirt should I buy" }), "small");
assert.equal(stakesOf(phd), "big");
assert.equal(
  stakesOf({ decision: "Watch a movie tonight", size: "small" }),
  "small",
);
assert.equal(stakesOf({ decision: "Which shirt", size: "big" }), "big");

assert.deepEqual(stepsFor({ decision: "Which shirt", when: "not-yet" }), [
  "sides",
  "gut",
  "card",
]);
assert.deepEqual(
  stepsFor({ decision: "Which shirt", when: "not-yet", photo: true }),
  ["sides", "tryon", "gut", "card"],
);
assert.deepEqual(
  stepsFor({ decision: "This phone or that one", when: "not-yet", size: "small" }),
  ["sides", "gut", "card"],
);
assert.deepEqual(stepsFor({ decision: "Keep the job", when: "not-yet", thing: true }), [
  "facts",
  "sides",
  "must",
  "future",
  "gut",
  "card",
]);
assert.deepEqual(
  stepsFor({ decision: "Which shirt", when: "not-yet", facts: 2 })[0],
  "facts",
);
assert.deepEqual(
  stepsFor({ decision: "Pick a lunch", when: "not-yet", thing: false }),
  ["sides", "gut", "card"],
);
assert.deepEqual(stepsFor(phd), ["facts", "sides", "must", "future", "gut", "card"]);
assert.deepEqual(stepsFor({ ...phd, fear: "money" }), [
  "facts",
  "sides",
  "cost",
  "must",
  "future",
  "gut",
  "card",
]);
assert.deepEqual(stepsFor({ ...phd, fear: "want" }), [
  "facts",
  "sides",
  "must",
  "gut",
  "card",
]);
assert.deepEqual(stepsFor({ ...phd, when: "already" }), [
  "facts",
  "sides",
  "cost",
  "must",
  "gut",
  "card",
]);

assert.equal(nextStep("facts", phd), "sides");
assert.equal(nextStep("sides", phd), "must");
assert.equal(nextStep("sides", { ...phd, fear: "money" }), "cost");
assert.equal(nextStep("card", phd), null);
assert.equal(progressOf("sides", phd), 2 / 7);
assert.equal(progressOf("lock", phd), null);

assert.equal(
  costLine({ keep: "100", leave: "140" }),
  "Switching costs 40 more.",
);
assert.equal(
  costLine({ keep: "$200", leave: "150" }),
  "Switching costs 50 less.",
);
assert.equal(costLine({ keep: "10", leave: "10" }), "Same cost either way.");
assert.equal(costLine({ keep: "", leave: "1" }), null);
assert.equal(
  costLine({ keep: "0", leave: "40000" }),
  "Switching costs 40,000 more.",
);
assert.equal(
  costLine({ keep: "0", leave: "1.5" }),
  "Switching costs 1.50 more.",
);
assert.equal(
  costLine({ keep: "9", leave: "5" }, "The master's"),
  "The master's costs 4 less.",
);

const checks = scheduleChecks(0);
assert.equal(checks[0].due, 7 * 24 * 60 * 60 * 1000);
assert.equal(checks[1].label, "1 month");
assert.equal(checks.length, 3);
assert.equal(dueCheck(checks, checks[0].due), checks[0]);
assert.equal(
  dueCheck([{ ...checks[0], feeling: "glad" }], checks[0].due),
  null,
);
assert.equal(isLocked(LOCK_MS, LOCK_MS - 1), true);
assert.equal(isLocked(LOCK_MS, LOCK_MS), false);

assert.equal(sensitiveOf("Should I start this medication"), "care");
assert.equal(sensitiveOf("Which treatment should I pick"), "care");
assert.equal(sensitiveOf("Should I stop taking my pills"), "care");
assert.equal(sensitiveOf("Should I sue my landlord"), "legal");
assert.equal(sensitiveOf("Which stock should I buy"), "invest");
assert.equal(sensitiveOf("Should I save or invest my bonus"), "invest");
assert.equal(sensitiveOf("Move my 401k"), "invest");
assert.equal(sensitiveOf("Should I go to law school or work"), null);
assert.equal(sensitiveOf("Should I invest time in a master's"), null);
assert.equal(sensitiveOf("Should I quit my job"), null);
assert.deepEqual(
  stepsFor({ decision: "Should I start this medication", when: "not-yet" }),
  ["facts", "sides", "must", "card"],
);

assert.deepEqual(
  [...PLAYS],
  ["cards", "doors", "point", "pets", "hold", "scratch"],
);
assert.equal(pickPlay("abc", []), pickPlay("abc", []));
const seen = ["cards", "doors", "point"];
assert.equal(seen.includes(pickPlay("ffomo-1", seen)), false);
assert.equal(PLAYS.includes(pickPlay("x", [...PLAYS])), true);

const at = (s: number, bpm: number, confidence = 80) => ({ at: s * 1e6, bpm, confidence });
const reads = [at(5, 90), at(12, 70), at(14, 72), at(25, 80), at(29, 82), at(29.5, 60, 5)];
assert.equal(pulseIn(reads, 15e6), 71);
assert.equal(pulseIn(reads, 30e6), 82);
assert.equal(pulseIn(reads, 50e6), null);
assert.equal(pulseLine({ a: 71, b: null }, "Stay", "Move"), "Pulse 71 on Stay, no read on Move.");

const thin = { glad: 1, regret: 0, mixed: 0, unclear: 0 };
const thick = { glad: 2, regret: 1, mixed: 1, unclear: 0 };
assert.equal(reported(thin), 1);
assert.equal(meterReady(thin), false);
assert.equal(meterReady(thick), true);
assert.equal(disagree(thin, { glad: 0, regret: 2 }), true);
assert.equal(disagree({ glad: 2, regret: 0 }, { glad: 3, regret: 0 }), false);
assert.equal(coinLand({ path: "a", why: "x" }, 0.9, "b"), "a");
assert.equal(coinLand(null, 0.1, "a"), "b");
assert.equal(coinLand(null, 0.1, null), "a");
assert.equal(coinLand(null, 0.9, "b"), "a");
assert.deepEqual(knownLean({ when: "already" }), { path: "a", why: "You already chose it." });
assert.deepEqual(knownLean({ when: "not-yet", enoughPath: "b" }), {
  path: "b",
  why: "Only it met your three must-haves.",
});
assert.equal(knownLean({ when: "not-yet", enoughPath: "both" }), null);
assert.deepEqual(gutRead({ a: true, b: false, face: true }, null), { path: "a", line: "You smiled." });
assert.deepEqual(gutRead({ a: false, b: true, face: true }, { path: "a", why: "x" }), {
  path: "b",
  line: "You smiled.",
});
assert.deepEqual(gutRead({ a: false, b: false, face: true }, { path: "b", why: "x" }), {
  path: "b",
  line: "No smile.",
});
assert.deepEqual(gutRead({ a: true, b: true, face: false }, null), {
  path: "a",
  line: "Couldn't see a face.",
});
assert.equal(
  gutCopy({ path: "a", line: "You smiled.", ignored: true, felt: "unrelated" }),
  "Something else was on my mind.",
);
assert.equal(
  gutCopy({ path: "a", line: "You smiled.", ignored: false, felt: "relieved" }),
  "Relieved it landed there. You smiled.",
);
