import assert from "node:assert/strict";
import { happyAfter } from "./gut.ts";

const rest = { smile: 0.42, frown: 0.18 };
assert.equal(happyAfter(rest, { smile: 0.48, frown: 0.55 }), false);
assert.equal(happyAfter(rest, { smile: 0.5, frown: 0.2 }), false);
assert.equal(happyAfter({ smile: 0.2, frown: 0.1 }, { smile: 0.72, frown: 0.12 }), true);
console.log("gut ok");
