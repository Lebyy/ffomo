"use client";

import { useEffect, useRef } from "react";
import { faceScore, loadFace } from "@/lib/gut";
import { markLive, pushScore, setStream } from "@/lib/watch";

// One camera for the gut check. No preview here; the gut screen shows the
// same stream. Detection runs at about 20 fps so the live feed stays smooth.
export function FaceWatch() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let cancel = false;
    let stream: MediaStream | null = null;
    let raf = 0;
    let lastDetect = 0;

    void (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) return;
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
        const marker = await loadFace();
        if (cancel) return;
        const tick = () => {
          if (cancel) return;
          const now = performance.now();
          if (video.readyState >= 2 && now - lastDetect >= 50) {
            lastDetect = now;
            const score = faceScore(marker.detectForVideo(video, now));
            if (score) pushScore(score, now);
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
