import { useSyncExternalStore } from "react";
import type { Check, Cost, Fear, GutRecord, Step } from "@/lib/flow";
import type { DecideResult, Fork } from "@/lib/schema";
import type { PathId } from "@/lib/settle";

const KEY = "ffomo";
const GONE = "ffomo-gone";

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
  undo?: "easy" | "hard";
  urgent?: boolean;
  thing?: boolean;
  shot?: string;
  step?: Step;
  fear?: Fear;
  fearLine?: string;
  fearNote?: string;
  cost?: Cost;
  musts?: string[];
  mustMarks?: { a: boolean; b: boolean }[];
  binding?: { on: boolean; checked: boolean; survives?: PathId };
  resolving?: { applies: boolean; checked: boolean; inHand: boolean };
  paid?: number;
  recoverable?: number;
  extra?: number;
  opens?: number;
  refreshes?: number;
  challenges?: number;
  cardAt?: number;
  enough?: string;
  enoughPath?: "a" | "b" | "both" | "neither";
  open?: string[];
  kept?: "a" | "b";
  closing?: "a" | "b";
  opening?: boolean;
  gut?: GutRecord;
  reasons?: string;
  lockUntil?: number;
  unlockNote?: string;
  checks?: Check[];
  at?: number;
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

function readGone() {
  if (typeof window === "undefined") return new Set<string>();
  try {
    const raw = localStorage.getItem(GONE);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : []);
  } catch {
    return new Set<string>();
  }
}

function rememberGone(id: string) {
  const gone = readGone();
  gone.add(id);
  localStorage.setItem(GONE, JSON.stringify([...gone].slice(-200)));
}

export function dropDecision(id: string) {
  try {
    rememberGone(id);
    writeAll(readAll().filter((item) => item.id !== id));
    void fetch(`/api/decisions?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
    return true;
  } catch {
    return false;
  }
}

export function saveDecision(item: SavedDecision) {
  try {
    const next = { ...item, at: Date.now() };
    const items = readAll().filter((saved) => saved.id !== next.id);
    items.unshift(next);
    writeAll(items);
    push(next);
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
    body: JSON.stringify({ at: item.at ?? Date.now(), item: forServer(item) }),
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
    const gone = readGone();
    const owner = localStorage.getItem(OWNER);
    const local = owner && owner !== userId ? [] : readAll();
    const byId = new Map(local.map((item) => [item.id, item]));
    const onServer = new Set(items.map((item) => item.id));
    const merged = items.flatMap((item) => {
      if (gone.has(item.id)) {
        void fetch(`/api/decisions?id=${encodeURIComponent(item.id)}`, { method: "DELETE" }).catch(() => {});
        return [];
      }
      const localItem = byId.get(item.id);
      if (localItem && (localItem.at ?? 0) > (item.at ?? 0)) {
        push(localItem);
        return [localItem];
      }
      return [withLocal(item, localItem)];
    });
    for (const item of local) {
      if (onServer.has(item.id) || gone.has(item.id)) continue;
      merged.push(item);
      push(item);
    }
    localStorage.setItem(OWNER, userId);
    const stillGone = readGone();
    writeAll(merged.filter((item) => !stillGone.has(item.id)));
  } catch {
    // ponytail: offline means the cache stands in until the next sign-in sync; no retry queue.
  } finally {
    synced = true;
    syncListeners.forEach((on) => on());
  }
}
