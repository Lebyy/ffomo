import { z } from "zod";

export const whenSchema = z.enum(["not-yet", "already"]);

export const decideRequestSchema = z.object({
  decision: z.string().trim().min(1).max(500),
  when: whenSchema,
  paths: z
    .object({
      a: z.string().trim().min(1).max(80),
      b: z.string().trim().min(1).max(80),
    })
    .optional(),
  context: z.array(z.string().trim().min(1).max(300)).max(6).optional(),
  size: z.enum(["small", "big"]).optional(),
  look: z.number().int().optional(),
  image: z.string().min(1).max(8_000_000).optional(),
});

export const askRequestSchema = z.object({
  decision: z.string().trim().min(1).max(500),
  when: whenSchema,
  image: z.string().min(1).max(8_000_000).optional(),
});

export const askSchema = z.object({
  pathA: z.string().trim().min(1).max(80),
  pathB: z.string().trim().min(1).max(80),
  others: z.array(z.string().trim().min(1).max(80)).max(4).optional(),
  size: z.enum(["small", "big"]),
  thing: z.boolean(),
  questions: z
    .array(
      z.object({
        text: z.string().trim().min(1).max(90),
        choices: z.array(z.string().trim().min(1).max(40)).max(4),
      }),
    )
    .max(3),
});

export type Fork = z.infer<typeof askSchema>;

export const storySchema = z.object({
  path: z.enum(["a", "b"]),
  text: z.string().trim().min(1).max(400),
  monthsLater: z.number().int().nonnegative().optional(),
  url: z.url().optional(),
  image: z.url().optional(),
  feeling: z.enum(["glad", "regret", "mixed", "unclear"]),
  fit: z.enum(["close", "unsure"]).optional(),
  promo: z.boolean().optional(),
  kind: z.enum(["check-in", "sketch"]).optional(),
});

function httpsOf(url: unknown) {
  if (typeof url !== "string") return "";
  let next = url.trim();
  if (!next) return "";
  if (next.startsWith("http://")) next = `https://${next.slice(7)}`;
  if (!/^https:\/\//i.test(next) && /^[\w.-]+\.[a-z]{2,}([/:?#]|$)/i.test(next))
    next = `https://${next}`;
  try {
    const parsed = new URL(next);
    return parsed.protocol === "https:" ? parsed.toString() : "";
  } catch {
    return "";
  }
}

function pathOf(
  value: unknown,
  paths?: { a?: unknown; b?: unknown },
): "a" | "b" | null {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();
  if (raw === "a" || raw === "path a" || raw === "1") return "a";
  if (raw === "b" || raw === "path b" || raw === "2") return "b";
  const a = String(paths?.a ?? "")
    .trim()
    .toLowerCase();
  const b = String(paths?.b ?? "")
    .trim()
    .toLowerCase();
  if (a && raw && (raw.includes(a) || a.includes(raw))) return "a";
  if (b && raw && (raw.includes(b) || b.includes(raw))) return "b";
  return null;
}

function monthsOf(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0)
    return Math.min(600, Math.round(value));
  if (typeof value !== "string") return undefined;
  const n = parseFloat(value);
  if (!Number.isFinite(n) || n < 0) return undefined;
  if (/year/i.test(value)) return Math.min(600, Math.round(n * 12));
  return Math.min(600, Math.round(n));
}

function feelingOf(value: unknown) {
  const raw = String(value ?? "").toLowerCase();
  if (raw.includes("regret") || raw.includes("sorry")) return "regret" as const;
  if (raw.includes("mix")) return "mixed" as const;
  if (raw.includes("glad") || raw.includes("happy") || raw.includes("relieved"))
    return "glad" as const;
  return "unclear" as const;
}

// Lite often writes path "A", "18 months", or a bare host. Keep the row.
export function asStory(
  raw: unknown,
  paths?: { a?: unknown; b?: unknown },
) {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const path = pathOf(row.path, paths) ?? "a";
  const url =
    httpsOf(row.url) ||
    httpsOf(row.uri) ||
    httpsOf(row.link) ||
    httpsOf(row.href) ||
    httpsOf(row.source);
  const text = [row.text, row.title, row.snippet, row.summary, row.quote]
    .find((value) => typeof value === "string" && value.trim())
    ?.toString()
    .trim() ?? "";
  if (!url || !text) return null;
  const monthsLater = monthsOf(row.monthsLater);
  const fit = row.fit === "close" || row.fit === "unsure" ? row.fit : undefined;
  const pic =
    httpsOf(row.image) ||
    httpsOf(row.thumbnail) ||
    httpsOf(row.ogImage) ||
    httpsOf(row.imageUrl);
  return {
    path,
    text: text.slice(0, 400),
    url,
    feeling: feelingOf(row.feeling),
    ...(monthsLater != null ? { monthsLater } : {}),
    ...(fit ? { fit } : {}),
    ...(row.promo === true ? { promo: true } : {}),
    ...(pic ? { image: pic } : {}),
  };
}

export function asWish(raw: unknown) {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const text = typeof row.text === "string" ? row.text.trim() : "";
  const urls = (Array.isArray(row.urls) ? row.urls : [row.url])
    .map(httpsOf)
    .filter(Boolean)
    .slice(0, 6);
  if (!text || urls.length === 0) return null;
  return { text: text.slice(0, 200), urls };
}

export function asBeat(raw: unknown) {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const when =
    row.when === "1 week" || row.when === "1 year" || row.when === "5 years"
      ? row.when
      : null;
  const text = typeof row.text === "string" ? row.text.trim() : "";
  const url = httpsOf(row.url);
  if (!when || !text || !url) return null;
  return { when, text: text.slice(0, 200), url };
}

export const beatSchema = z.object({
  when: z.enum(["1 week", "1 year", "5 years"]),
  text: z.string().trim().min(1).max(200),
  url: z.url(),
});

export const wishSchema = z.object({
  text: z.string().trim().min(1).max(200),
  urls: z.array(z.url()).min(1).max(6),
});

export const decideSchema = z.object({
  pathA: z.string().trim().min(1).max(80),
  pathB: z.string().trim().min(1).max(80),
  stories: z.array(storySchema).max(20),
  skipped: z.number().int().nonnegative().max(99),
  wish: z.array(wishSchema).max(6),
  unknown: z.array(z.string().trim().min(1).max(160)).max(3),
  futureA: z.array(beatSchema).max(3),
  futureB: z.array(beatSchema).max(3),
});

export const factSchema = z.object({
  text: z.string().trim().min(1).max(200),
  url: z.url(),
  source: z.string().trim().min(1).max(60),
});

export const factsSchema = z.object({
  facts: z.array(factSchema).max(4),
});

export const enoughRequestSchema = z.object({
  pathA: z.string().trim().min(1).max(80),
  pathB: z.string().trim().min(1).max(80),
  stories: z
    .array(
      z.object({
        path: z.enum(["a", "b"]),
        text: z.string().trim().min(1).max(400),
      }),
    )
    .max(12),
  musts: z.array(z.string().trim().min(1).max(200)).length(3),
  facts: z
    .array(z.object({ text: z.string().trim().min(1).max(200) }))
    .max(4)
    .optional(),
});

export const enoughSchema = z.object({
  path: z.enum(["a", "b", "both", "neither"]),
  sentence: z.string().trim().min(1).max(180),
  open: z.array(z.string().trim().min(1).max(200)).max(3),
});

export const leanRequestSchema = z.object({
  decision: z.string().trim().min(1).max(1000),
  pathA: z.string().trim().min(1).max(80),
  pathB: z.string().trim().min(1).max(80),
  said: z.array(z.string().trim().min(1).max(400)).min(1).max(12),
});

export const leanSchema = z.object({
  path: z.enum(["a", "b", "none"]),
  quote: z.string().trim().max(120),
});

export const previewRequestSchema = z.object({
  image: z.string().min(1).max(8_000_000),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  caption: z.string().trim().min(1).max(500),
  kind: z.enum(["face", "item"]).optional(),
});

export type DecideRequest = z.infer<typeof decideRequestSchema>;
export type AskRequest = z.infer<typeof askRequestSchema>;
export type EnoughRequest = z.infer<typeof enoughRequestSchema>;
export type LeanRequest = z.infer<typeof leanRequestSchema>;
export type Story = Omit<z.infer<typeof storySchema>, "url"> & {
  url?: string;
  strength: 1 | 2 | 3;
  kind?: "check-in" | "sketch";
};
export type Beat = z.infer<typeof beatSchema>;

export type SideMeter = {
  glad: number;
  regret: number;
  mixed?: number;
  unclear?: number;
  strength: number;
};

export type Wish = z.infer<typeof wishSchema>;
export type Fact = z.infer<typeof factSchema>;

export type DecideResult = {
  pathA: string;
  pathB: string;
  stories: Story[];
  wish: Wish[];
  futureA: Beat[];
  futureB: Beat[];
  meter: { a: SideMeter; b: SideMeter };
  facts?: Fact[];
  factsAt?: number;
  skipped?: number;
  dropped?: number;
  unknown?: string[];
};

// Results saved before wish lines carried their own links were plain strings.
export function wishOf(result: Pick<DecideResult, "wish">): Wish[] {
  return (result.wish as (Wish | string)[]).flatMap((item) =>
    typeof item === "string" ? [] : [item],
  );
}
