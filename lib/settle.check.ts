import assert from "node:assert/strict";
import { settleFork } from "./settle-map.ts";
import {
  CAUSE_LINE,
  CHECK_LINE,
  checkMove,
  classify,
  fadeOf,
  orderSide,
  phasesOf,
  recommend,
  scoreAlarm,
  settle,
  crowdWord,
  sideOf,
  strongPath,
  switchCost,
  visibleCount,
  type SettleFork,
  type SettleRecord,
} from "./settle.ts";

function fork(patch: Partial<SettleFork> = {}): SettleFork {
  return {
    mode: "decide",
    fearText: "",
    urgent: false,
    size: "big",
    undo: "hard",
    binding: { on: false, checked: false },
    resolving: { applies: false, checked: false, inHand: false },
    numbers: null,
    musts: [],
    gut: null,
    records: [],
    opens: 0,
    refreshes: 0,
    challenges: 0,
    locked: false,
    reason: "",
    ...patch,
  };
}

const others = "everyone who did not do this looks happier";

assert.equal(classify(others, "rescue"), "others");
assert.equal(classify("I chose the wrong life", "decide"), "best");
assert.equal(classify("", "decide"), "best");
assert.equal(classify("", "rescue"), "door");
assert.equal(classify("a missing fact about the price", "decide"), "fact");
assert.equal(CAUSE_LINE.others, "Other people.");

const openRegret = fork({
  mode: "rescue",
  fearText: others,
  taken: "a",
});
const loud = scoreAlarm(openRegret, "others");
assert.equal(loud.threat, 48);
assert.equal(loud.volatility, 10);
assert.equal(loud.control, 28);
assert.equal(loud.stress, 50);
assert.equal(loud.alarm, 46);
assert.equal(loud.band, "restless");

const quiet = scoreAlarm(
  fork({
    mode: "rescue",
    fearText: others,
    taken: "a",
    locked: true,
    musts: [
      { text: "A job I can stand", a: true, b: false },
      { text: "A week I can keep", a: false, b: false },
      { text: "One part I don't hate", a: false, b: false },
    ],
    gut: { coin: "a", reaction: "nothing", latencyMs: 900 },
    reason: "I am finishing it",
  }),
  "others",
);
assert.equal(quiet.threat, 14);
assert.equal(quiet.volatility, 0);
assert.equal(quiet.control, 94);
assert.equal(quiet.stress, 40);
assert.equal(quiet.alarm, 16);
assert.equal(quiet.band, "quiet");
assert.equal(quiet.controlBand, "re-engaged");

assert.deepEqual(fadeOf(46), {
  closed: [46, 29, 17, 8],
  open: [46, 41, 36, 29],
});

assert.equal(checkMove(null, 40), "yours");
assert.equal(checkMove(46, 40), "quieter");
assert.equal(checkMove(16, 22), "louder");
assert.equal(checkMove(16, 18), "same");
assert.match(CHECK_LINE.louder, /rise stays/);

assert.equal(switchCost({ paid: 80, recoverable: 30, extra: 10 }), 60);
assert.equal(switchCost(null), null);

function rows(path: "a" | "b", stance: "glad" | "regret", n: number): SettleRecord[] {
  return Array.from({ length: n }, () => ({ path, stance }));
}

assert.equal(crowdWord(4, 0), null);
assert.equal(crowdWord(5, 0), "Most were glad.");
assert.equal(crowdWord(2, 2, 1), null);
assert.equal(sideOf(rows("a", "glad", 4), "a").most, false);
assert.equal(sideOf(rows("a", "glad", 5), "a").loud, true);
assert.equal(sideOf([...rows("a", "glad", 2), ...rows("a", "regret", 3)], "a").loud, true);
assert.equal(
  sideOf([...rows("a", "glad", 2), ...rows("a", "regret", 2), { path: "a", stance: "mixed" }], "a").loud,
  false,
);

assert.equal(strongPath({ coin: "a", reaction: "relief", latencyMs: 4000 }), "a");
assert.equal(strongPath({ coin: "a", reaction: "dread", latencyMs: 1000 }), "b");
assert.equal(strongPath({ coin: "a", reaction: "relief", latencyMs: 4001 }), null);
assert.equal(strongPath({ coin: "b", reaction: "nothing", latencyMs: 100 }), null);

const stay = recommend(
  fork({
    size: "small",
    undo: "easy",
    binding: { on: true, checked: true, survives: "a" },
    gut: { coin: "b", reaction: "relief", latencyMs: 500 },
  }),
);
assert.equal(stay.path, "a");
assert.equal(stay.treatment, "FACT");
assert.equal(stay.disagree, true);
assert.equal(stay.hold, false);

const unchecked = recommend(fork({ resolving: { applies: true, checked: false, inHand: false } }));
assert.equal(unchecked.treatment, "FACT");
assert.equal(unchecked.hold, true);
assert.equal(unchecked.next, "Check it before you decide.");

const cheap = recommend(
  fork({
    mode: "rescue",
    taken: "a",
    records: [...rows("a", "regret", 5), ...rows("b", "glad", 5)],
    numbers: { paid: 100, recoverable: 100, extra: 0 },
  }),
);
assert.equal(cheap.path, "b");
assert.equal(cheap.treatment, "RECONSIDER");

const senior = recommend(
  fork({
    mode: "rescue",
    taken: "a",
    size: "big",
    undo: "hard",
    records: [...rows("a", "regret", 5), ...rows("b", "glad", 5)],
    numbers: { paid: 100, recoverable: 0, extra: 0 },
  }),
);
assert.equal(senior.path, "a");
assert.equal(senior.treatment, "COMMITMENT");

const enough = recommend(
  fork({
    musts: [
      { text: "Worn on a normal day", a: true, b: false },
      { text: "Lasts the afternoon", a: true, b: false },
      { text: "The money doesn't sting", a: true, b: true },
    ],
  }),
);
assert.equal(enough.path, "a");
assert.equal(enough.treatment, "GOOD-ENOUGH");

const bottle = recommend(
  fork({
    size: "small",
    undo: "easy",
    gut: { coin: "b", reaction: "nothing", latencyMs: 8000 },
  }),
);
assert.equal(bottle.path, "b");
assert.equal(bottle.treatment, "COMMITMENT");
assert.match(bottle.next, /theater/);

const flinch = recommend(
  fork({
    size: "small",
    undo: "easy",
    gut: { coin: "a", reaction: "dread", latencyMs: 900 },
  }),
);
assert.equal(flinch.path, "b");
assert.equal(flinch.treatment, "GUT");

const gap = recommend(
  fork({
    size: "big",
    undo: "hard",
    records: [...rows("a", "glad", 5), ...rows("b", "glad", 1), ...rows("b", "regret", 4)],
  }),
);
assert.equal(gap.path, "a");
assert.equal(gap.treatment, "EVIDENCE");
assert.match(gap.next, /selected sample/);

const none = recommend(fork({ size: "big", undo: "hard" }));
assert.equal(none.path, null);
assert.equal(none.next, "There is no best.");

const tie = recommend(
  fork({
    size: "small",
    undo: "hard",
    gut: { coin: "b", reaction: "nothing", latencyMs: 9000 },
    musts: [
      { text: "One", a: true, b: true },
      { text: "Two", a: true, b: true },
      { text: "Three", a: true, b: true },
    ],
  }),
);
assert.equal(tie.path, "b");
assert.equal(tie.treatment, "GOOD-ENOUGH");

assert.deepEqual(phasesOf(fork({ size: "small", undo: "easy" })).phases, ["gut", "card"]);
assert.equal(phasesOf(fork({ size: "small", undo: "easy" })).lockDays, 0);
const hardSmall = phasesOf(
  fork({ size: "small", undo: "hard", records: [{ path: "a", stance: "glad" }], binding: { on: true, checked: false } }),
);
assert.deepEqual(hardSmall.phases, ["name", "facts", "sides", "gut", "card"]);
assert.equal(hardSmall.lockDays, 0);
const big = phasesOf(fork({ size: "big", undo: "hard", records: [{ path: "a", stance: "glad" }] }));
assert.equal(big.draft, false);
assert.equal(big.lockDays, 0);
assert.equal(big.phases.at(-1), "card");
assert.equal(phasesOf(fork({ size: "big", undo: "easy" })).draft, false);

const ordered = orderSide(
  [
    { stance: "glad", monthsLater: 0 },
    { stance: "regret", monthsLater: 24 },
    { stance: "regret", monthsLater: 1 },
  ],
  "rescue",
  "b",
  "a",
);
assert.equal(ordered[0].stance, "regret");
assert.equal(ordered[0].monthsLater, 24);

assert.deepEqual(visibleCount(5, 0), { show: 3, blocked: false });
assert.deepEqual(visibleCount(5, 1), { show: 5, blocked: false });
assert.deepEqual(visibleCount(5, 2), { show: 3, blocked: true });

const plan = settle(openRegret);
assert.equal(plan.score.alarm, 46);
assert.equal(plan.honesty.inventedStories, false);
assert.equal(plan.honesty.inventedNumbers, false);
assert.equal(plan.interrupt, false);
assert.equal(settle(fork({ refreshes: 2 })).interrupt, true);

const openPick = fork({ fearText: "wanting the best one", size: "small", undo: "easy" });
const shutPick = scoreAlarm(
  { ...openPick, locked: true, reason: "I am taking the shift" },
  "best",
);
assert.ok(shutPick.alarm < scoreAlarm(openPick, "best").alarm);
assert.ok(scoreAlarm({ ...openPick, challenges: 1 }, "best").alarm > scoreAlarm(openPick, "best").alarm);
const mapped = settleFork({
  id: "t",
  decision: "night shift",
  when: "not-yet",
  kept: "a",
  challenges: 1,
  reasons: "I am taking it",
});
assert.equal(mapped.locked, true);
assert.equal(mapped.challenges, 1);
assert.equal(settleFork({ id: "t", decision: "night shift", when: "not-yet" }).locked, false);

console.log("settle ok");
