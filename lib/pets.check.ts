import assert from "node:assert/strict";
import { PALETTES, PET_KINDS, runsOf, spriteOf } from "./pets.ts";

for (const kind of PET_KINDS) {
  const rows = spriteOf(kind);
  assert.equal(rows.length, 16, `${kind} is 16 rows`);
  for (const row of rows) assert.equal(row.length, 16, `${kind}: "${row}"`);
  for (const run of runsOf(rows)) {
    assert.ok(PALETTES[kind][run.key], `${kind} has a color for ${run.key}`);
  }
  assert.ok(runsOf(rows).some((run) => run.key === "e"), `${kind} has eyes`);
}

assert.deepEqual(runsOf([".oo.b"]), [
  { x: 1, y: 0, w: 2, key: "o" },
  { x: 4, y: 0, w: 1, key: "b" },
]);
