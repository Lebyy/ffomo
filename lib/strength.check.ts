import assert from "node:assert/strict";
import { storyStrength } from "./strength.ts";

assert.equal(storyStrength(undefined), 1);
assert.equal(storyStrength(0), 1);
assert.equal(storyStrength(1), 2);
assert.equal(storyStrength(11), 2);
assert.equal(storyStrength(12), 3);
assert.equal(storyStrength(40), 3);
