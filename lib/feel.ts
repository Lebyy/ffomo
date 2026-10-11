"use client";

import { env, InferenceSession, Tensor } from "onnxruntime-web/wasm";
import { faceRect, scoreFromLogits, type FaceScore } from "./gut";

// EmotiEffLib enet_b0_8_va_mtl, Apache-2.0. Eight AffectNet expressions plus
// valence. Weights load with the page. The crop never leaves this file.
const MODEL = "/models/feel.onnx";
const ORT = "1.30.0";
const SIZE = 224;
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

let starting: Promise<InferenceSession | null> | null = null;
let session: InferenceSession | null = null;
let failed = false;
let canvas: HTMLCanvasElement | null = null;
let pixels: Float32Array | null = null;

export function feelReady() {
  return session != null;
}

export function feelDead() {
  return failed;
}

export function loadFeel() {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (session) return Promise.resolve(session);
  if (!starting) starting = boot();
  return starting;
}

async function boot() {
  try {
    env.wasm.numThreads = 1;
    env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT}/dist/`;
    session = await InferenceSession.create(MODEL, {
      executionProviders: ["wasm"],
      graphOptimizationLevel: "all",
    });
    return session;
  } catch {
    failed = true;
    return null;
  }
}

function paint(
  video: HTMLVideoElement,
  box: { x: number; y: number; s: number },
) {
  if (!canvas) canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(video, box.x, box.y, box.s, box.s, 0, 0, SIZE, SIZE);
  const image = ctx.getImageData(0, 0, SIZE, SIZE);
  const plane = SIZE * SIZE;
  if (!pixels) pixels = new Float32Array(3 * plane);
  const src = image.data;
  for (let i = 0; i < plane; i++) {
    const offset = i * 4;
    pixels[i] = (src[offset] / 255 - MEAN[0]) / STD[0];
    pixels[plane + i] = (src[offset + 1] / 255 - MEAN[1]) / STD[1];
    pixels[plane * 2 + i] = (src[offset + 2] / 255 - MEAN[2]) / STD[2];
  }
  return pixels;
}

// Crop happens before the first await. MediaPipe reuses the landmark object.
export async function readFeel(
  video: HTMLVideoElement,
  result: Parameters<typeof faceRect>[0],
): Promise<FaceScore | null> {
  const live = session;
  if (!live || !video.videoWidth) return null;
  const box = faceRect(result, video.videoWidth, video.videoHeight);
  if (!box) return null;
  const data = paint(video, box);
  if (!data) return null;
  try {
    const out = await live.run({
      input: new Tensor("float32", data, [1, 3, SIZE, SIZE]),
    });
    const tensor = out.output ?? Object.values(out)[0];
    const raw = tensor?.data;
    if (!raw || typeof raw[0] !== "number") return null;
    return scoreFromLogits(raw as ArrayLike<number>);
  } catch {
    return null;
  }
}
