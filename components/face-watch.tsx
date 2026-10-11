"use client";

import { useEffect, useRef } from "react";
import { faceScore, loadFace } from "@/lib/gut";
import { markLive, pushScore, setGrabber } from "@/lib/watch";

function frame(video: HTMLVideoElement) {
  if (!video.videoWidth) return;
  const width = 240;
  const height = Math.max(1, Math.round((width * video.videoHeight) / video.videoWidth));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.translate(width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.72);
}

// One camera for the whole session. No preview.
export function FaceWatch() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let cancel = false;
    let stream: MediaStream | null = null;
    let raf = 0;
    setGrabber(() => frame(video));

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
        video.srcObject = stream;
        await video.play();
        const marker = await loadFace();
        if (cancel) return;
        const tick = () => {
          if (cancel) return;
          if (video.readyState >= 2) {
            const score = faceScore(marker.detectForVideo(video, performance.now()));
            if (score) pushScore(score);
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
      setGrabber(null);
      markLive(false);
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
