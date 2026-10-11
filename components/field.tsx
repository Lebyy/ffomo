"use client";

import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import BlurryBlob from "@/components/animata/background/blurry-blob";
import { MOODS, moodOf, type Mood } from "@/lib/flow";
import { useMounted } from "@/lib/store";

const BLOBS: Record<Mood, [string, string]> = {
  soda: ["bg-fuchsia-400", "bg-lime-300"],
  film: ["bg-orange-400", "bg-rose-400"],
  pool: ["bg-cyan-300", "bg-amber-300"],
  candy: ["bg-pink-400", "bg-emerald-300"],
};

const THEME: Record<Mood, string> = {
  soda: "#14101f",
  film: "#1a120e",
  pool: "#0d1718",
  candy: "#1a1020",
};

let homeGuard = "";

function readHome() {
  try {
    return Number(localStorage.getItem("ffomo-mood") || "0") || 0;
  } catch {
    return 0;
  }
}

function Frame({ mood, children }: { mood: Mood; children: ReactNode }) {
  useEffect(() => {
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME[mood]);
  }, [mood]);

  return (
    <div data-mood={mood} className="field relative h-dvh overflow-hidden">
      <BlurryBlob firstBlobColor={BLOBS[mood][0]} secondBlobColor={BLOBS[mood][1]} />
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
}

// usePathname suspends on a dynamic id during prerender. The boundary is here
// so the rest of the app still paints.
function MoodSync({ onMood }: { onMood: (mood: Mood) => void }) {
  const path = usePathname();
  const mounted = useMounted();
  const [home, setHome] = useState(0);
  const id = path.match(/^\/d\/([^/]+)/)?.[1] ?? "";
  const mood: Mood = !mounted ? "soda" : id ? moodOf(id) : MOODS[home % MOODS.length];

  useEffect(() => {
    onMood(mood);
  }, [mood, onMood]);

  useEffect(() => {
    if (id) {
      homeGuard = "";
      return;
    }
    if (homeGuard === "home") return;
    homeGuard = "home";
    const n = readHome();
    setHome(n);
    try {
      localStorage.setItem("ffomo-mood", String((n + 1) % MOODS.length));
    } catch {}
  }, [id]);

  return null;
}

export function Field({ children }: { children: ReactNode }) {
  const [mood, setMood] = useState<Mood>("soda");
  return (
    <Frame mood={mood}>
      <Suspense fallback={null}>
        <MoodSync onMood={setMood} />
      </Suspense>
      {children}
    </Frame>
  );
}
