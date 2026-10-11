import assert from "node:assert/strict";
import { forkFrom } from "./fork.ts";

{
  const fork = forkFrom("Keep the job, or take the other offer", false);
  assert.equal(fork.pathA, "Keep the job");
  assert.equal(fork.pathB, "take the other offer");
  assert.equal(fork.thing, false);
}
{
  const fork = forkFrom(
    "I bought a tesla model y 2023 but for 19k more im getting BRAND NEW 2026 Tesla with H4",
    true,
  );
  assert.match(fork.pathA, /tesla model y 2023/i);
  assert.match(fork.pathB, /2026 Tesla/i);
  assert.equal(fork.thing, true);
  assert.equal(fork.size, "big");
}
{
  const fork = forkFrom("Stay", false);
  assert.equal(fork.pathA, "Stay");
  assert.equal(fork.pathB, "The other way");
}

console.log("fork ok");
