"use client";

import { useEffect, useState } from "react";

type Prompt = Event & { prompt: () => Promise<void> };

function standalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function RegisterApp() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js");
  }, []);
  return null;
}

export function InstallHint() {
  const [mode, setMode] = useState<"off" | "share" | "prompt">("off");
  const [prompt, setPrompt] = useState<Prompt | null>(null);

  useEffect(() => {
    if (standalone()) return;
    setMode("share");
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as Prompt);
      setMode("prompt");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (mode === "prompt" && prompt) {
    return (
      <button
        type="button"
        className="line-clamp-1 text-left text-xs font-medium text-primary"
        onClick={() => void prompt.prompt()}
      >
        Add to Home Screen
      </button>
    );
  }
  if (mode === "share") {
    return (
      <p className="line-clamp-1 text-xs text-muted-foreground">
        Share, then Add to Home Screen.
      </p>
    );
  }
  return null;
}
