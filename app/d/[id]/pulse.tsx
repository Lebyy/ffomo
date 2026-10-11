"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Fit } from "@/components/fit";
import { Pet } from "@/components/pet";
import { pulseIn, type GutRecord, type PulseReading } from "@/lib/flow";

const W = 192;
const WARM = 4000;
const EACH = 15000;
const TAIL = 2500;

type Stage = "warm" | "a" | "b" | "tail";

function nowUs() {
  return Math.round((performance.timeOrigin + performance.now()) * 1000);
}

export function PulseRead({
  pathA,
  pathB,
  onDone,
}: {
  pathA: string;
  pathB: string;
  onDone: (pulse: GutRecord["pulse"] | null, problem: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [order] = useState<("a" | "b")[]>(() =>
    Math.random() < 0.5 ? ["a", "b"] : ["b", "a"],
  );
  const [stage, setStage] = useState<Stage>("warm");
  const [hint, setHint] = useState("");
  const done = useEffectEvent(onDone);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let cancel = false;
    let ended = false;
    let stream: MediaStream | null = null;
    let timer = 0;
    let id = "";
    let sending = false;
    let readings: PulseReading[] = [];
    let w = W;
    let h = 144;
    const frames: { ts: number; data: Uint8ClampedArray }[] = [];
    const ends = { a: 0, b: 0 };
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    async function end(problem = "") {
      if (ended) return;
      ended = true;
      window.clearInterval(timer);
      stream?.getTracks().forEach((track) => track.stop());
      if (id) {
        const last = await fetch(`/api/pulse?id=${id}`, { method: "DELETE" })
          .then((res) => res.json() as Promise<{ readings?: PulseReading[] }>)
          .catch(() => ({ readings: undefined }));
        if (last.readings?.length) readings = last.readings;
      }
      if (cancel) return;
      if (problem) return done(null, problem);
      done({ a: pulseIn(readings, ends.a), b: pulseIn(readings, ends.b) }, "");
    }

    async function flush() {
      if (sending || frames.length === 0 || !id) return;
      sending = true;
      const batch = frames.splice(0, frames.length);
      const size = w * h * 4;
      const buf = new ArrayBuffer(12 + batch.length * (8 + size));
      const view = new DataView(buf);
      view.setUint32(0, w, true);
      view.setUint32(4, h, true);
      view.setUint32(8, batch.length, true);
      let at = 12;
      for (const frame of batch) {
        view.setFloat64(at, frame.ts, true);
        new Uint8Array(buf, at + 8, size).set(frame.data);
        at += 8 + size;
      }
      try {
        const res = await fetch(`/api/pulse?id=${id}`, {
          method: "POST",
          headers: { "content-type": "application/octet-stream" },
          body: buf,
        });
        const body = (await res.json()) as {
          readings?: PulseReading[];
          hint?: string;
          error?: string;
        };
        if (!res.ok || body.error) throw new Error(body.error || "The pulse read stopped.");
        readings = body.readings ?? readings;
        if (!cancel) setHint(body.hint ?? "");
      } catch (err) {
        void end(err instanceof Error ? err.message : "The pulse read stopped.");
      } finally {
        sending = false;
      }
    }

    void (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("no camera");
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        if (cancel) return stream.getTracks().forEach((track) => track.stop());
        video.srcObject = stream;
        await video.play();
        h = Math.round((W * video.videoHeight) / video.videoWidth) || 144;
        w = W;
        canvas.width = w;
        canvas.height = h;
      } catch {
        return void end("Camera stayed off.");
      }
      const res = await fetch("/api/pulse", { method: "POST" }).catch(() => null);
      const body = (await res?.json().catch(() => ({}))) as { id?: string; error?: string } | undefined;
      if (!res?.ok || !body?.id) return void end(body?.error ?? "Pulse reads aren't available here.");
      if (cancel) return void fetch(`/api/pulse?id=${body.id}`, { method: "DELETE" });
      id = body.id;
      const t0 = performance.now();
      let shown: Stage = "warm";
      timer = window.setInterval(() => {
        if (cancel || ended) return;
        const t = performance.now() - t0;
        if (video.readyState >= 2 && ctx) {
          ctx.drawImage(video, 0, 0, w, h);
          frames.push({ ts: nowUs(), data: ctx.getImageData(0, 0, w, h).data });
        }
        const next: Stage =
          t < WARM ? "warm" : t < WARM + EACH ? order[0] : t < WARM + 2 * EACH ? order[1] : "tail";
        if (next !== shown) {
          if (shown === "a" || shown === "b") ends[shown] = nowUs();
          shown = next;
          setStage(next);
        }
        if (frames.length >= 15) void flush();
        if (t >= WARM + 2 * EACH + TAIL) void flush().then(() => end());
      }, 1000 / 30);
    })();

    return () => {
      cancel = true;
      void end();
    };
  }, [order]);

  const name = stage === "a" ? pathA : stage === "b" ? pathB : "";
  const ms = stage === "warm" ? WARM : stage === "tail" ? TAIL : EACH;
  return (
    <div className="relative min-h-0 flex-1 overflow-hidden rounded-3xl bg-muted">
      <video
        ref={videoRef}
        playsInline
        muted
        className="h-full w-full object-cover [transform:scaleX(-1)]"
      />
      <div className="absolute inset-x-3 bottom-3 flex flex-col gap-2 rounded-2xl bg-background/85 p-3">
        <div className="flex items-center gap-3">
          {stage === "a" || stage === "b" ? (
            <Pet key={stage} kind={stage === "a" ? "cat" : "duck"} mood="hop" size={36} />
          ) : null}
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-xs text-muted-foreground">
              {stage === "warm"
                ? "Look at the camera. Hold still."
                : stage === "tail"
                  ? "Almost done."
                  : `Think about this one · ${order.indexOf(stage) + 1} of 2`}
            </span>
            {name ? <Fit max={22} min={14} lines={2} className="font-pixel font-semibold">{name}</Fit> : null}
          </div>
        </div>
        <span className="block h-1.5 overflow-hidden rounded-full bg-muted">
          <span
            key={stage}
            className="run-bar block h-full bg-primary"
            style={{ "--run": `${ms}ms` } as React.CSSProperties}
          />
        </span>
        {hint ? (
          <p role="status" className="text-sm font-medium text-mixed">
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  );
}
