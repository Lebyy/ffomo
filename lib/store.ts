import { useSyncExternalStore } from "react";
import type { Check, Cost, Fear, GutRecord, Step } from "@/lib/flow";
import type { DecideResult, Fork } from "@/lib/schema";

const KEY = "ffomo";

export type Answer = { q: string; a: string };

export type SavedDecision = {
  id: string;
  decision: string;
  when: "not-yet" | "already";
  result?: DecideResult;
  fork?: Fork;
  asked?: boolean;
  paired?: boolean;
  voice?: boolean;
  answers?: Answer[];
  size?: "small" | "big";
  thing?: boolean;
  shot?: string;
  step?: Step;
  fear?: Fear;
  cost?: Cost;
  musts?: string[];
  enough?: string;
  enoughPath?: "a" | "b" | "both" | "neither";
  open?: string[];
  kept?: "a" | "b";
  gut?: GutRecord;
  reasons?: string;
  lockUntil?: number;
  unlockNote?: string;
  checks?: Check[];
};

function readAll(): SavedDecision[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as SavedDecision[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(items: SavedDecision[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("ffomo-store"));
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener("ffomo-store", onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener("ffomo-store", onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

const never = () => () => {};

export function useMounted() {
  return useSyncExternalStore(never, () => true, () => false);
}

export function useDecisions() {
  const raw = useSyncExternalStore(
    subscribe,
    () => localStorage.getItem(KEY) ?? "",
    () => "",
  );
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as SavedDecision[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function listDecisions() {
  return readAll();
}

export function readDecision(id: string) {
  return readAll().find((item) => item.id === id) ?? null;
}

export function saveDecision(item: SavedDecision) {
  try {
    const items = readAll().filter((saved) => saved.id !== item.id);
    items.unshift(item);
    writeAll(items);
    push(item);
    return true;
  } catch {
    return false;
  }
}

// Photos, face stills, and pulse numbers stay on the phone. The rest goes to Mongo.
export function forServer(item: SavedDecision): SavedDecision {
  const out = { ...item, gut: item.gut && { ...item.gut } };
  delete out.shot;
  delete out.gut?.still;
  delete out.gut?.pulse;
  if (!out.gut) delete out.gut;
  return out;
}

export function withLocal(server: SavedDecision, local?: SavedDecision): SavedDecision {
  if (!local) return server;
  return {
    ...server,
    shot: local.shot,
    gut: server.gut ? { ...server.gut, still: local.gut?.still, pulse: local.gut?.pulse } : local.gut,
  };
}

function push(item: SavedDecision) {
  void fetch("/api/decisions", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ at: Date.now(), item: forServer(item) }),
  }).catch(() => {});
}

const OWNER = "ffomo-owner";
let syncing: string | null = null;
let synced = false;
const syncListeners = new Set<() => void>();

export function useSynced() {
  return useSyncExternalStore(
    (on) => {
      syncListeners.add(on);
      return () => syncListeners.delete(on);
    },
    () => synced,
    () => false,
  );
}

export async function syncDecisions(userId: string) {
  if (syncing === userId) return;
  syncing = userId;
  try {
    const res = await fetch("/api/decisions");
    if (!res.ok) return;
    const { items } = (await res.json()) as { items: SavedDecision[] };
    const owner = localStorage.getItem(OWNER);
    const local = owner && owner !== userId ? [] : readAll();
    const byId = new Map(local.map((item) => [item.id, item]));
    const onServer = new Set(items.map((item) => item.id));
    const merged = items.map((item) => withLocal(item, byId.get(item.id)));
    for (const item of local) {
      if (onServer.has(item.id)) continue;
      merged.push(item);
      push(item);
    }
    localStorage.setItem(OWNER, userId);
    writeAll(merged);
  } catch {
    // ponytail: offline means the cache stands in until the next sign-in sync; no retry queue.
  } finally {
    synced = true;
    syncListeners.forEach((on) => on());
  }
}
