"use client";

import { useEffect, useRef } from "react";
import { faceScore, loadFace } from "@/lib/gut";
import { clearWatch, markLive, pushScore, setStream } from "@/lib/watch";

// ponytail: blendshapes cover this read if the expression model is still
// downloading when the coin is about to land. One scale per read.

// One camera for the gut check. No preview here; the gut screen shows the
// same stream. The expression model runs as fast as the phone allows.
export function FaceWatch() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let cancel = false;
    let stream: MediaStream | null = null;
    let raf = 0;
    let lastDetect = 0;
    let busy = false;
    clearWatch();

    void (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) return;
        const feelPromise = import("@/lib/feel");
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });
        if (cancel) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        markLive(true);
        setStream(stream);
        video.srcObject = stream;
        await video.play();
        const [marker, feel] = await Promise.all([loadFace(), feelPromise]);
        void feel.loadFeel();
        if (cancel) return;
        const opened = performance.now();
        let scale: "wait" | "feel" | "shape" = "wait";
        let felt = false;
        let feelMiss = 0;
        const tick = () => {
          if (cancel) return;
          const now = performance.now();
          if (video.readyState >= 2 && !busy && now - lastDetect >= 50) {
            lastDetect = now;
            const found = marker.detectForVideo(video, now);
            if (scale === "wait" && feel.feelReady()) scale = "feel";
            if (scale === "feel") {
              busy = true;
              void feel.readFeel(video, found).then((score) => {
                if (cancel) return;
                if (score) {
                  felt = true;
                  pushScore(score, now);
                  return;
                }
                if (!felt && ++feelMiss >= 4) scale = "shape";
              }).finally(() => {
                busy = false;
              });
            } else if (scale === "shape" || feel.feelDead() || now - opened > 1500) {
              scale = "shape";
              const score = faceScore(found);
              if (score) pushScore(score, now);
            }
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch {
        markLive(false);
      }
    })();

    return () => {
      cancel = true;
      cancelAnimationFrame(raf);
      markLive(false);
      setStream(null);
      stream?.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
    };
  }, []);

  return (
    <video
      ref={videoRef}
      playsInline
      muted
      autoPlay
      aria-hidden
      className="pointer-events-none fixed top-0 left-0 -z-10 h-32 w-24 opacity-[0.01]"
    />
  );
}
