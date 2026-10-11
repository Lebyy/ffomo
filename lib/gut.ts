"use client";

import type { FaceLandmarker, FaceLandmarkerResult } from "@mediapipe/tasks-vision";

const WASM =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.0/wasm";
const MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

export type FaceKind = "feel" | "shape";

export type FaceScore = {
  smile: number;
  frown: number;
  confused: number;
  kind?: FaceKind;
};

export type Verdict = "smile" | "none" | "confused" | "noface" | "off";

export const VERDICT_LINE: Record<Verdict, string> = {
  smile: "You smiled.",
  none: "No smile.",
  confused: "You looked unsure.",
  noface: "Couldn't see a face.",
  off: "Camera stayed off.",
};

// AffectNet order: anger, contempt, disgust, fear, happiness, neutral, sadness, surprise.
// A 10th value is valence in [-1, 1]. A clearly negative valence vetoes a smile.
const FROWN_AT = [0, 1, 2, 6];

function softmax8(raw: ArrayLike<number>) {
  let max = -Infinity;
  for (let i = 0; i < 8; i++) if (raw[i] > max) max = raw[i];
  let sum = 0;
  const p = [0, 0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < 8; i++) {
    p[i] = Math.exp(raw[i] - max);
    sum += p[i];
  }
  for (let i = 0; i < 8; i++) p[i] /= sum;
  return p;
}

export function scoreFromLogits(raw: ArrayLike<number>): FaceScore | null {
  if (raw.length < 8) return null;
  const p = softmax8(raw);
  let frown = 0;
  for (const i of FROWN_AT) if (p[i] > frown) frown = p[i];
  const smile = p[4];
  const confused = Math.max(p[3], p[7]);
  if (raw.length >= 10 && raw[8] <= -0.15)
    frown = Math.max(frown, Math.min(1, -raw[8]), smile);
  return { smile, frown, confused, kind: "feel" };
}

// Blendshapes ("shape") need a rise: a resting face sits near 0.4. The
// expression model ("feel") can be read without a baseline, but only a
// clear smile or a clear unsure look. A made-up prior turns a resting
// face into "You smiled."
export function verdictFrom(before: FaceScore | null, after: FaceScore[]): Verdict {
  if (after.length < 4) return "noface";
  const kind = after[0].kind ?? "shape";
  const rows = after.filter((row) => (row.kind ?? "shape") === kind);
  if (rows.length < 4) return "noface";
  const same = before && (before.kind ?? "shape") === kind ? before : null;
  if (!same) {
    if (kind !== "feel") return "noface";
    let peakSmile = 0;
    let peakConfused = 0;
    let peakFrown = 0;
    for (const score of rows) {
      if (score.smile > peakSmile) peakSmile = score.smile;
      if (score.confused > peakConfused) peakConfused = score.confused;
      if (score.frown > peakFrown) peakFrown = score.frown;
    }
    if (peakSmile >= 0.62 && peakSmile >= peakFrown + 0.2) return "smile";
    if (peakConfused >= 0.45 && peakConfused > peakSmile) return "confused";
    return "none";
  }
  const base = same;
  let peakSmile = 0;
  let peakRise = -1;
  let peakConfused = 0;
  let peakFrown = 0;
  for (const score of rows) {
    if (score.smile > peakSmile) peakSmile = score.smile;
    const rise = score.smile - base.smile;
    if (rise > peakRise) peakRise = rise;
    if (score.confused > peakConfused) peakConfused = score.confused;
    if (score.frown > peakFrown) peakFrown = score.frown;
  }
  const feel = kind === "feel";
  if (
    peakRise >= (feel ? 0.12 : 0.15) &&
    peakSmile >= (feel ? 0.36 : 0.45) &&
    peakSmile >= peakFrown + 0.1
  )
    return "smile";
  if (peakConfused - base.confused >= (feel ? 0.1 : 0.12) && peakConfused >= (feel ? 0.28 : 0.3))
    return "confused";
  return "none";
}

let landmarker: FaceLandmarker | null = null;

export async function loadFace() {
  if (landmarker) return landmarker;
  const { FaceLandmarker, FilesetResolver } = await import(
    "@mediapipe/tasks-vision"
  );
  const files = await FilesetResolver.forVisionTasks(WASM);
  landmarker = await FaceLandmarker.createFromOptions(files, {
    baseOptions: { modelAssetPath: MODEL },
    runningMode: "VIDEO",
    numFaces: 1,
    outputFaceBlendshapes: true,
  });
  return landmarker;
}

export function faceScore(result: FaceLandmarkerResult): FaceScore | null {
  if ((result.faceLandmarks?.length ?? 0) === 0) return null;
  const categories = result.faceBlendshapes[0]?.categories ?? [];
  const score = (name: string) =>
    categories.find((category) => category.categoryName === name)?.score ?? 0;
  const pair = (left: string, right: string) => (score(left) + score(right)) / 2;
  return {
    smile: pair("mouthSmileLeft", "mouthSmileRight"),
    frown: Math.max(
      pair("mouthFrownLeft", "mouthFrownRight"),
      pair("browDownLeft", "browDownRight"),
    ),
    confused: Math.max(
      score("mouthPucker"),
      pair("mouthPressLeft", "mouthPressRight"),
      score("browInnerUp") * 0.9,
    ),
    kind: "shape",
  };
}

export function faceRect(result: FaceLandmarkerResult, width: number, height: number) {
  const marks = result.faceLandmarks?.[0];
  if (!marks?.length || width < 2 || height < 2) return null;
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  for (const point of marks) {
    if (point.x < minX) minX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.x > maxX) maxX = point.x;
    if (point.y > maxY) maxY = point.y;
  }
  const cx = ((minX + maxX) / 2) * width;
  const cy = ((minY + maxY) / 2) * height;
  let side = Math.max((maxX - minX) * width, (maxY - minY) * height) * 1.35;
  side = Math.min(side, width, height);
  if (side < 24) return null;
  return {
    x: Math.min(Math.max(0, cx - side / 2), width - side),
    y: Math.min(Math.max(0, cy - side / 2), height - side),
    s: side,
  };
}
