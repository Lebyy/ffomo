import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const GALLERY = JSON.parse(
  readFileSync(new URL("./gallery.json", import.meta.url), "utf8"),
) as { id: string; src: string }[];

assert.ok(GALLERY.length >= 800, `gallery has ${GALLERY.length}`);
assert.ok(GALLERY.every((pet) => pet.src.startsWith("https://")));
assert.equal(new Set(GALLERY.map((pet) => pet.id)).size, GALLERY.length);
