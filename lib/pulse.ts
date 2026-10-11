import type { SmartSpectraSDK } from "@smartspectra/node-sdk";

export type Reading = { at: number; bpm: number; confidence: number };
export type PulseState = { readings: Reading[]; hint: string; error: string };

type Session = PulseState & { id: string; sdk: SmartSpectraSDK; touched: number; last: number };

// ponytail: the native SDK is process-global, so one read runs at a time on
// this server. A second phone waits. Upgrade path: a worker process per read.
const box = globalThis as { ffomoPulse?: Session };
const STALE = 15_000;
const ERRORS: Record<number, string> = {
  2: "The pulse key didn't work.",
  4: "No pulse reads left on this key.",
  5: "Couldn't reach the pulse service.",
  6: "Couldn't reach the pulse service.",
};

function state(s: Session): PulseState {
  return { readings: s.readings, hint: s.hint, error: s.error };
}

async function end(s: Session) {
  if (box.ffomoPulse === s) box.ffomoPulse = undefined;
  try {
    await s.sdk.stopAsync();
  } catch {}
  try {
    await s.sdk.destroy();
  } catch {}
}

export async function startPulse(): Promise<{ id: string } | { busy: true } | { off: string }> {
  const key = process.env.SMARTSPECTRA_API_KEY;
  if (!key) return { off: "Pulse reads aren't set up on this server." };
  const old = box.ffomoPulse;
  if (old && Date.now() - old.touched < STALE) return { busy: true };
  if (old) await end(old);

  let ss: typeof import("@smartspectra/node-sdk");
  let decode: typeof import("@smartspectra/node-sdk/messages").decodeMetrics;
  try {
    ss = await import("@smartspectra/node-sdk");
    decode = (await import("@smartspectra/node-sdk/messages")).decodeMetrics;
  } catch {
    return { off: "Pulse reads don't run on this server." };
  }

  const sdk = new ss.SmartSpectraSDK({
    apiKey: key,
    requestedMetrics: [ss.MetricType.PULSE_RATE],
    enableTelemetry: false,
  });
  const s: Session = { id: crypto.randomUUID(), sdk, readings: [], hint: "", error: "", touched: Date.now(), last: 0 };
  // Readings are stamped with the last frame sent, which is the phone's clock.
  sdk.on("metrics", (buf: Buffer) => {
    const p = decode(buf).cardio?.pulseRate?.at(-1);
    if (!p?.value) return;
    s.readings.push({ at: s.last, bpm: Math.round(p.value), confidence: Math.round(p.confidence ?? 0) });
    if (s.readings.length > 400) s.readings.shift();
  });
  sdk.on("validationStatus", (code: number, _ts: number, hint: string) => {
    s.hint = code === 0 ? "" : hint;
  });
  sdk.on("error", (code: number) => {
    s.error = ERRORS[code] ?? "The pulse read stopped.";
  });
  try {
    sdk.useCustomInput();
    sdk.start();
  } catch {
    await end(s);
    return { off: "Pulse read couldn't start." };
  }
  box.ffomoPulse = s;
  return { id: s.id };
}

const HEAD = 12;

// Body: u32 width, u32 height, u32 count, then count × (f64 µs timestamp, RGBA pixels).
export function feedPulse(id: string, body: ArrayBuffer): PulseState | null {
  const s = box.ffomoPulse;
  if (!s || s.id !== id) return null;
  s.touched = Date.now();
  const view = new DataView(body);
  if (body.byteLength < HEAD) return state(s);
  const w = view.getUint32(0, true);
  const h = view.getUint32(4, true);
  const n = view.getUint32(8, true);
  const size = w * h * 4;
  if (!w || !h || w > 640 || h > 640 || body.byteLength !== HEAD + n * (8 + size)) return state(s);
  let at = HEAD;
  for (let i = 0; i < n; i++) {
    const ts = Math.round(view.getFloat64(at, true));
    const pixels = Buffer.from(body, at + 8, size);
    at += 8 + size;
    if (ts <= s.last) continue;
    try {
      s.sdk.sendFrame(pixels, w, h, w * 4, 2, ts);
      s.last = ts;
    } catch {}
  }
  return state(s);
}

export async function stopPulse(id: string): Promise<PulseState | null> {
  const s = box.ffomoPulse;
  if (!s || s.id !== id) return null;
  const out = state(s);
  await end(s);
  return out;
}
