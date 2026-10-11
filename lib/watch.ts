"use client";

import { verdictFrom, VERDICT_LINE, type FaceScore, type Verdict } from "./gut";

type Sample = FaceScore & { at: number };

const samples: Sample[] = [];
let saw = false;
let live = false;
let feed: MediaStream | null = null;
let watchVideo: HTMLVideoElement | null = null;
let source: "feel" | "shape" | null = null;

export function watchLive() {
  return live;
}

export function markLive(on: boolean) {
  live = on;
}

// One camera for the session. The gut check shows this same stream, so we
// never open a second camera just to preview the face.
export function setStream(stream: MediaStream | null) {
  feed = stream;
}

export function getStream() {
  return feed;
}

export function setWatchVideo(video: HTMLVideoElement | null) {
  watchVideo = video;
}

export function getWatchVideo() {
  return watchVideo;
}

export function clearWatch() {
  samples.length = 0;
  saw = false;
  source = null;
}

export function pushScore(score: FaceScore, at = performance.now()) {
  const kind = score.kind ?? "shape";
  if (source && kind !== source) return;
  source = kind;
  saw = true;
  samples.push({ ...score, at });
  // Keep enough for a long reading window. ~20 fps over ~15s is 300 frames.
  if (samples.length > 900) samples.splice(0, samples.length - 700);
}

function mean(rows: Sample[]): FaceScore | null {
  if (rows.length < 4) return null;
  let smile = 0;
  let frown = 0;
  let confused = 0;
  for (const row of rows) {
    smile += row.smile;
    frown += row.frown;
    confused += row.confused;
  }
  const n = rows.length;
  return {
    smile: smile / n,
    frown: frown / n,
    confused: confused / n,
    kind: rows[0].kind ?? "shape",
  };
}

// Baseline is the resting face just before it landed. The reaction is every
// frame from after it landed to now, so a brief look is not missed.
export function readReaction(land: number, until: number) {
  const before = mean(samples.filter((row) => row.at >= land - 1400 && row.at < land));
  const after = samples.filter((row) => row.at >= land + 300 && row.at <= until);
  return { before, after, saw };
}

export function reactionVerdict(
  land: number,
  until: number,
  camera: boolean,
): { verdict: Verdict; line: string } {
  if (!camera) return { verdict: "off", line: VERDICT_LINE.off };
  const { before, after, saw: sawFace } = readReaction(land, until);
  if (!sawFace) return { verdict: "noface", line: VERDICT_LINE.noface };
  const verdict = verdictFrom(before, after);
  return { verdict, line: VERDICT_LINE[verdict] };
}
