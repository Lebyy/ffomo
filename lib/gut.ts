"use client";

import type { FaceLandmarker, FaceLandmarkerResult } from "@mediapipe/tasks-vision";

const WASM =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.0/wasm";
const MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

export type FaceScore = { smile: number; frown: number; confused: number };

export type Verdict = "smile" | "none" | "confused" | "noface" | "off";

export const VERDICT_LINE: Record<Verdict, string> = {
  smile: "You smiled.",
  none: "No smile.",
  confused: "You looked unsure.",
  noface: "Couldn't see a face.",
  off: "Camera stayed off.",
};

// Reads every frame from after the coin landed, not one snapshot. A resting
// face sits near 0.4 on the smile shapes, so we look for a real rise that
// beats a frown. A pressed or puckered mouth with raised inner brows is the
// unsure look, caught only when there was no smile.
export function verdictFrom(before: FaceScore | null, after: FaceScore[]): Verdict {
  if (!before || after.length < 4) return "noface";
  let peakSmile = 0;
  let peakRise = -1;
  let peakConfused = 0;
  let peakFrown = 0;
  for (const score of after) {
    if (score.smile > peakSmile) peakSmile = score.smile;
    const rise = score.smile - before.smile;
    if (rise > peakRise) peakRise = rise;
    if (score.confused > peakConfused) peakConfused = score.confused;
    if (score.frown > peakFrown) peakFrown = score.frown;
  }
  if (peakRise >= 0.15 && peakSmile >= 0.45 && peakSmile >= peakFrown + 0.1)
    return "smile";
  if (peakConfused - before.confused >= 0.12 && peakConfused >= 0.3)
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
  };
}
