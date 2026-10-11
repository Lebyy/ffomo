"use client";

import { happyAfter, type FaceScore } from "./gut";

type Sample = FaceScore & { at: number };

const samples: Sample[] = [];
let saw = false;
let live = false;
let grabber: (() => string | undefined) | null = null;

export function watchLive() {
  return live;
}

export function markLive(on: boolean) {
  live = on;
}

export function setGrabber(fn: (() => string | undefined) | null) {
  grabber = fn;
}

export function grabFace() {
  return grabber?.();
}

export function pushScore(score: FaceScore, at = performance.now()) {
  saw = true;
  samples.push({ ...score, at });
  if (samples.length > 240) samples.splice(0, samples.length - 180);
}

function mean(rows: Sample[]): FaceScore | null {
  if (rows.length < 4) return null;
  let smile = 0;
  let frown = 0;
  for (const row of rows) {
    smile += row.smile;
    frown += row.frown;
  }
  return { smile: smile / rows.length, frown: frown / rows.length };
}

export function reactionAt(landed: number) {
  const before = mean(samples.filter((row) => row.at >= landed - 1000 && row.at < landed));
  const after = mean(samples.filter((row) => row.at >= landed + 400 && row.at <= landed + 1600));
  return { before, after, saw };
}

export function reactionLine(
  before: FaceScore | null,
  after: FaceScore | null,
  sawFace: boolean,
  camera: boolean,
) {
  if (!camera) return "Camera stayed off.";
  if (!sawFace || !before || !after) return "Couldn't see a face.";
  return happyAfter(before, after) ? "You smiled." : "No smile.";
}
