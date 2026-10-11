"use client";

import type { FaceLandmarker, FaceLandmarkerResult } from "@mediapipe/tasks-vision";

const WASM =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.0/wasm";
const MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

export type FaceScore = { smile: number; frown: number };

// A smile has to rise after the coin and beat the frown. A resting face
// sits near 0.4 on the smile shapes, and a frown moves those too.
export function happyAfter(before: FaceScore, after: FaceScore) {
  const rise = after.smile - before.smile;
  return rise >= 0.15 && after.smile >= 0.45 && after.smile >= after.frown + 0.12;
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
  };
}
