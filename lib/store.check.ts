import assert from "node:assert/strict";
import { forServer, withLocal, type SavedDecision } from "./store.ts";

const local = {
  id: "12345678",
  decision: "Keep it or switch",
  when: "not-yet",
  shot: "data:image/jpeg;base64,AAAA",
  gut: { path: "a", felt: "relieved", line: "You smiled.", ignored: false, still: "data:x", pulse: { a: 70 }, play: "hold" },
} as unknown as SavedDecision;

const sent = forServer(local);
assert.equal(sent.shot, undefined);
assert.equal(sent.gut?.still, undefined);
assert.equal(sent.gut?.pulse, undefined);
assert.equal(sent.gut?.line, "You smiled.");
assert.equal(local.shot, "data:image/jpeg;base64,AAAA");

const back = withLocal(sent, local);
assert.equal(back.shot, local.shot);
assert.equal(back.gut?.still, "data:x");
assert.deepEqual(back.gut?.pulse, { a: 70 });
assert.equal(withLocal(sent).shot, undefined);
console.log("store ok");
