import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { forkFrom } from "@/lib/fork";
import { cleanLine, freshStories, pickStories, sourced, type Found } from "@/lib/lines";
import { openaiJson, openaiReady, openaiSearch } from "@/lib/openai";
import {
  askSchema,
  decideSchema,
  enoughSchema,
  factsSchema,
  leanSchema,
  type AskRequest,
  type DecideRequest,
  type EnoughRequest,
  type LeanRequest,
} from "@/lib/schema";

// Gemini 3 models answer with search on but hand back no sources, so every
// link would be the model's guess. 2.5 Flash returns the pages it read.
export const SEARCH_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite"] as const;
export const ASK_MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash",
  "gemini-3.8-flash",
] as const;
export const IMAGE_MODELS = ["gemini-3.1-flash-image", "gemini-2.5-flash-image"] as const;
export const IMAGE = IMAGE_MODELS[0];

export type Progress =
  | { kind: "query"; text: string }
  | { kind: "posts"; n: number }
  | { kind: "retry" };

export function gemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: { retryOptions: { attempts: 1 } },
  });
}

export function scrubNulls(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrubNulls);
  if (!value || typeof value !== "object") return value;
  const next: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (item === null) continue;
    next[key] = scrubNulls(item);
  }
  return next;
}

type ModelReply = {
  output_text?: string;
  output_image?: { data?: string; mime_type?: string };
  steps?: Array<{
    type?: string;
    text?: string;
    data?: string;
    mime_type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
};

export function textFrom(interaction: ModelReply) {
  if (interaction.output_text) return interaction.output_text;
  const parts: string[] = [];
  for (const step of interaction.steps ?? []) {
    if (step.type === "text" && typeof step.text === "string")
      parts.push(step.text);
    if (step.type !== "model_output") continue;
    for (const item of step.content ?? []) {
      if (item.type === "text" && typeof item.text === "string")
        parts.push(item.text);
    }
  }
  return parts.join("");
}

export function overloaded(err: unknown) {
  const message = err instanceof Error ? `${err.name} ${err.message}` : "";
  // Quota is per model, so a 429 on one Flash can still go through on the next.
  return /\b(429|500|503|504)\b|high demand|quota|timed out|timeout|abort|unavailable|not found/i.test(
    message,
  );
}

export function parseModelJson(text: string) {
  const trimmed = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/```$/, "");
  try {
    return scrubNulls(JSON.parse(trimmed));
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start)
      return scrubNulls(JSON.parse(trimmed.slice(start, end + 1)));
    throw new SyntaxError("empty search json");
  }
}

function clip(value: unknown, max: number) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

function photoOf(image?: string) {
  if (!image) return null;
  const mime = image.match(/^data:(image\/[a-z0-9.+-]+);base64,/i)?.[1] ?? "image/jpeg";
  const data = image.replace(/^data:image\/[a-z0-9.+-]+;base64,/i, "");
  if (!data) return null;
  return { mime, data };
}

function contentsOf(input: string, image?: string) {
  const photo = photoOf(image);
  return photo
    ? [{ text: input }, { inlineData: { mimeType: photo.mime, data: photo.data } }]
    : input;
}

function thinking(model: string) {
  return model.startsWith("gemini-3") ? { thinkingConfig: { thinkingBudget: 0 } } : {};
}

// The whole call has one deadline, split across the models it tries.
const LOOSE = new Set(["$schema", "minLength", "maxLength", "minimum", "maximum", "format"]);

// The shape the model must answer in. Lengths and formats are checked after, by the fit and the schema.
function shapeOf(schema: z.ZodType) {
  return JSON.parse(JSON.stringify(z.toJSONSchema(schema), (key, value) => (LOOSE.has(key) ? undefined : value)));
}

async function askJson<T>(
  ai: GoogleGenAI,
  {
    input,
    system,
    schema,
    fit,
    image,
    timeout = 20_000,
    budget = 40_000,
  }: {
    input: string;
    system: string;
    schema: z.ZodType<T>;
    fit: (value: unknown) => unknown;
    image?: string;
    timeout?: number;
    budget?: number;
  },
) {
  const deadline = Date.now() + budget;
  let last: unknown = new Error("503 no model answered");
  const shape = shapeOf(schema);
  if (openaiReady()) {
    try {
      return schema.parse(fit(parseModelJson(await openaiJson(input, system, timeout, image, shape))));
    } catch (err) {
      console.error("openai failed", (err instanceof Error ? err.message : "").slice(0, 160));
    }
  }
  for (const model of ASK_MODELS) {
    const left = deadline - Date.now();
    if (left < 4_000) break;
    try {
      const res = await ai.models.generateContent({
        model,
        contents: contentsOf(input, image),
        config: {
          systemInstruction: system,
          responseMimeType: "application/json",
          responseJsonSchema: shape,
          abortSignal: AbortSignal.timeout(Math.min(timeout, left)),
          ...thinking(model),
        },
      });
      return schema.parse(fit(parseModelJson(res.text ?? "")));
    } catch (err) {
      last = err;
      console.error("model failed", model, (err instanceof Error ? err.message : "").slice(0, 160));
      const bad = err instanceof SyntaxError || (err as Error)?.name === "ZodError";
      if (!overloaded(err) && !bad) throw err;
    }
  }
  throw last;
}

type SearchRow = { line: string; sources: { url: string; site: string }[] };

type SearchHooks = {
  onText?: (text: string, final: boolean) => void;
  onRows?: (rows: SearchRow[]) => void;
};

// Lines of text, each with the pages that line came from. OpenAI and Google
// search side by side; each finds posts the other misses, and both cite real pages.
// Whichever writes a line first reports it. The slower one does not hold the first card.
async function grounded(
  ai: GoogleGenAI,
  input: string,
  system: string,
  image?: string,
  hooks?: SearchHooks,
) {
  const [open, google] = await Promise.allSettled([
    openaiReady() ? openaiSearch(input, system, image, hooks) : Promise.resolve([]),
    googleSearch(ai, input, system, image, hooks),
  ]);
  if (open.status === "rejected")
    console.error("openai search failed", (open.reason instanceof Error ? open.reason.message : "").slice(0, 160));
  if (open.status === "rejected" && google.status === "rejected") throw google.reason;
  return [
    ...(open.status === "fulfilled" ? open.value : []),
    ...(google.status === "fulfilled" ? google.value : []),
  ];
}

function rowsOf(
  text: string,
  meta?: {
    groundingChunks?: { web?: { uri?: string; title?: string } }[];
    groundingSupports?: { segment?: { text?: string }; groundingChunkIndices?: number[] }[];
  },
) {
  const chunks = (meta?.groundingChunks ?? []).map((chunk) => ({
    url: chunk.web?.uri ?? "",
    site: chunk.web?.title ?? "",
  }));
  return sourced(text, chunks, meta?.groundingSupports ?? []);
}

async function googleSearch(
  ai: GoogleGenAI,
  input: string,
  system: string,
  image?: string,
  hooks?: SearchHooks,
) {
  let last: unknown = new Error("503 no model answered");
  for (const [i, model] of SEARCH_MODELS.entries()) {
    try {
      const timeout = i === 0 ? 50_000 : 25_000;
      const config = {
        systemInstruction: system,
        tools: [{ googleSearch: {} }],
        abortSignal: AbortSignal.timeout(timeout),
      };
      let text = "";
      let meta: Parameters<typeof rowsOf>[1];
      try {
        const stream = await ai.models.generateContentStream({
          model,
          contents: contentsOf(input, image),
          config,
        });
        for await (const chunk of stream) {
          const bit = chunk.text ?? "";
          if (bit) text = bit.startsWith(text) ? bit : text + bit;
          const next = chunk.candidates?.[0]?.groundingMetadata;
          if (next) meta = next;
          if (bit) hooks?.onText?.(text, false);
        }
      } catch (err) {
        if (text) throw err;
        const res = await ai.models.generateContent({
          model,
          contents: contentsOf(input, image),
          config,
        });
        text = res.text ?? "";
        meta = res.candidates?.[0]?.groundingMetadata;
      }
      hooks?.onText?.(text, true);
      const rows = rowsOf(text, meta);
      if (rows.length) hooks?.onRows?.(rows);
      return rows;
    } catch (err) {
      last = err;
      console.error("search failed", model, (err instanceof Error ? err.message : "").slice(0, 160));
      if (!overloaded(err)) throw err;
    }
  }
  throw last;
}

async function namePhoto(ai: GoogleGenAI, image: string) {
  const photo = photoOf(image);
  if (!photo) return "";
  for (const model of ["gemini-3.1-flash-lite", "gemini-2.5-flash"] as const) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents: [
          {
            text: "Name the exact item in this photo in under 12 words. Type, color, material, cut. No sentence. No brand unless it is printed on the item.",
          },
          { inlineData: { mimeType: photo.mime, data: photo.data } },
        ],
        config: { abortSignal: AbortSignal.timeout(8_000), ...thinking(model) },
      });
      const name = (res.text ?? "").replace(/\s+/g, " ").trim();
      if (name) return name.slice(0, 80);
    } catch {
      /* next model */
    }
  }
  return "";
}

const FIND = `You find what real people wrote after they already made a choice. You do not advise and you do not pick a side.
Use Google Search. Find firsthand posts where the poster made the choice themselves and says how it went: Reddit, forums, blogs, owner reviews, follow-ups. Prefer posts written weeks or years later over launch-day posts.
Output only lines, one per post. No intro, no headers, no markdown, no tables:
SIDE ; FEELING ; MONTHS ; SENTENCE
SIDE is A or B, the path that poster took.
FEELING is glad, regret, mixed, or unclear. Mixed means they name a real upside and a real cost.
MONTHS is how long after the choice they wrote, as a number of months (0 if under a month), or ? if the post does not say.
SENTENCE is one sentence in your own words of what that poster reported. If they say what they wish they had known, include it. No usernames. Never "you".
Only write a line for a post you actually found in these search results. Never invent a post. Up to 8 lines. If nothing turns up, output nothing.`;

export async function askDecision(
  ai: GoogleGenAI,
  body: DecideRequest,
  onProgress?: (event: Progress) => void,
  live?: {
    onOpen?: (story: NonNullable<ReturnType<typeof freshStories>>[number]) => void;
    onFound?: (stories: Found[]) => void;
    onMiss?: (text: string) => void;
  },
) {
  const seen = body.image ? await namePhoto(ai, body.image) : "";
  const named = body.paths ?? (() => {
    const fork = forkFrom(body.decision, Boolean(body.image));
    return { a: fork.pathA, b: fork.pathB };
  })();
  const about = [
    `Decision: ${body.decision}`,
    `They have ${body.when === "already" ? "already chosen" : "not chosen yet"}.`,
    `Path A: ${named.a}`,
    `Path B: ${named.b}`,
    ...(body.context ?? []).slice(0, 4).map((line) => `About them: ${clip(line, 120)}`),
    ...(seen
      ? [`They sent a photo of: ${seen}. Same type, color, and cut only.`]
      : body.image
        ? ["They sent a photo of the thing. Same type, color, and cut only."]
        : []),
  ];
  const side = async (path: "a" | "b") => {
    const name = path === "a" ? named.a : named.b;
    onProgress?.({ kind: "query", text: name });
    const seenLines = new Set<string>();
    const hooks: SearchHooks = {
      onText(text, final) {
        for (const story of freshStories(text, seenLines, final)) live?.onOpen?.(story);
      },
      onRows(batch) {
        const picked = pickStories(batch);
        if (picked.length) live?.onFound?.(picked);
      },
    };
    try {
      const rows = await grounded(
        ai,
        [...about, `Find people who took path ${path.toUpperCase()}: ${name}. Tag anyone you find on the other path as the other letter.`].join("\n"),
        FIND,
        seen ? undefined : body.image,
        hooks,
      );
      const final = pickStories(rows);
      for (const text of seenLines) {
        if (!final.some((story) => story.text === text)) live?.onMiss?.(text);
      }
      return rows;
    } catch (err) {
      for (const text of seenLines) live?.onMiss?.(text);
      throw err;
    }
  };
  const sides = await Promise.allSettled([side("a"), side("b")]);
  if (sides.every((one) => one.status === "rejected")) throw (sides[0] as PromiseRejectedResult).reason;
  const rows = sides.flatMap((one) => (one.status === "fulfilled" ? one.value : []));
  const found = pickStories(rows);
  onProgress?.({ kind: "posts", n: found.length });

  const stories: z.infer<typeof decideSchema>["stories"] = found.map((story) => ({
    path: story.path,
    feeling: story.feeling,
    text: story.text,
    url: story.url,
    ...(story.monthsLater != null ? { monthsLater: story.monthsLater } : {}),
  }));
  const shaped = stories.length > 0 ? await shape(ai, about, stories) : null;
  const sketches = await Promise.all(
    (["a", "b"] as const).map((path) =>
      stories.some((story) => story.path === path)
        ? []
        : sketch(ai, body.decision, path === "a" ? named.a : named.b, path),
    ),
  );
  return {
    pathA: clip(named.a, 80) as string,
    pathB: clip(named.b, 80) as string,
    stories: [...stories, ...sketches.flat()].slice(0, 20),
    skipped: 0,
    wish: shaped?.wish ?? [],
    unknown: shaped?.unknown ?? [],
    futureA: shaped?.futureA ?? [],
    futureB: shaped?.futureB ?? [],
  };
}

const SHAPE = `You read numbered posts that were already found. You do not search, advise, or pick a side. JSON only:
{ "wish": [{ "text", "posts": [numbers] }], "future": [{ "path": "a"|"b", "when": "1 week"|"1 year"|"5 years", "text", "post": number }], "unknown": [strings] }
wish: things posters say they wish they had known, or a surprise they only learned after choosing. posts lists every post number that says it. Rank by how many posts say it. Never write "most" or "many" when one post says it. No wish without a post.
future: per path, only horizons the posts on that path cover. "1 week" is under a month, "1 year" is 1 to 23 months, "5 years" is 24 months or more. text is what that poster reported, never "you will". post is that post's number and must be on that path.
unknown: up to three short things these posts do not answer for this person, written to them, like "Your city" or "Your budget". Never "the user".
Hide usernames.`;

const shapeSchema = z.object({
  wish: z
    .array(z.object({ text: z.string().trim().min(1).max(200), posts: z.array(z.number().int()).min(1).max(6) }))
    .max(6),
  future: z
    .array(
      z.object({
        path: z.enum(["a", "b"]),
        when: z.enum(["1 week", "1 year", "5 years"]),
        text: z.string().trim().min(1).max(200),
        post: z.number().int(),
      }),
    )
    .max(6),
  unknown: z.array(z.string().trim().min(1).max(160)).max(3),
});

async function shape(
  ai: GoogleGenAI,
  about: string[],
  stories: { path: "a" | "b"; feeling: string; text: string; url?: string; monthsLater?: number }[],
) {
  const fit = (value: unknown) => {
    const raw = (value ?? {}) as Record<string, unknown>;
    const list = (key: string, max: number) => (Array.isArray(raw[key]) ? raw[key].slice(0, max) : []);
    return {
      wish: list("wish", 6).map((item) => {
        if (!item || typeof item !== "object") return item;
        const row = item as { text?: unknown; posts?: unknown };
        return { ...row, text: clip(row.text, 200), posts: Array.isArray(row.posts) ? row.posts.slice(0, 6) : [] };
      }),
      future: list("future", 6).map((item) =>
        item && typeof item === "object" ? { ...item, text: clip((item as { text?: unknown }).text, 200) } : item,
      ),
      unknown: list("unknown", 3).map((item) => clip(item, 160)),
    };
  };
  try {
    const out = await askJson(ai, {
      input: [
        ...about,
        "Posts:",
        ...stories.map(
          (story, i) =>
            `#${i + 1} [${story.path.toUpperCase()}, ${story.monthsLater ?? "?"} months, ${story.feeling}] ${story.text}`,
        ),
      ].join("\n"),
      system: SHAPE,
      schema: shapeSchema,
      fit,
      timeout: 12_000,
      budget: 20_000,
    });
    const urlOf = (n: number) => stories[n - 1]?.url;
    const beats = (path: "a" | "b") =>
      out.future.flatMap((beat) => {
        const story = stories[beat.post - 1];
        return story?.url && story.path === path ? [{ when: beat.when, text: beat.text, url: story.url }] : [];
      }).filter((beat, i, all) => all.findIndex((other) => other.when === beat.when) === i);
    // Both paths at the same horizons, or neither.
    const a = beats("a");
    const b = beats("b");
    const shared = (list: typeof a, other: typeof a) => list.filter((beat) => other.some((x) => x.when === beat.when));
    return {
      wish: out.wish.flatMap((item) => {
        const urls = [...new Set(item.posts.flatMap((n) => urlOf(n) ?? []))];
        return urls.length > 0 ? [{ text: item.text, urls }] : [];
      }),
      unknown: out.unknown as string[],
      futureA: shared(a, b),
      futureB: shared(b, a),
    };
  } catch (err) {
    console.error("shape failed", (err instanceof Error ? err.message : "").slice(0, 300));
    return null;
  }
}

const sketchSchema = z.object({
  stories: z
    .array(
      z.object({
        text: z.string().trim().min(1).max(400),
        feeling: z.enum(["glad", "regret", "mixed", "unclear"]),
        monthsLater: z.number().int().nonnegative().optional(),
      }),
    )
    .min(1)
    .max(4),
});

// Search found nobody on this path. Short lines, labeled on screen as no post.
async function sketch(ai: GoogleGenAI, decision: string, name: string, path: "a" | "b") {
  try {
    const out = await askJson(ai, {
      input: `No later posts came back for: ${name}. Context: ${decision}. Write 3 short later-outcome sentences people commonly report for this kind of choice. Mix glad, regret, and mixed. No URLs.`,
      system:
        'You fill an empty side when search found nothing. JSON only: { "stories": [{ "text", "feeling", "monthsLater" }] }. One sentence each. No URLs. No advice. No names.',
      schema: sketchSchema,
      fit: (value) => value,
      timeout: 10_000,
      budget: 14_000,
    });
    return out.stories.map((row) => ({
      path,
      text: row.text,
      feeling: row.feeling,
      ...(row.monthsLater != null ? { monthsLater: row.monthsLater } : {}),
      kind: "sketch" as const,
    }));
  } catch {
    return [];
  }
}

const FACTS = `You check plain facts before anyone reads opinions. You do not advise and you do not pick a side.
Use Google Search. Find up to four facts about the options themselves that a person could miss and that would change this choice: what it includes or leaves out, what it costs, what it requires, deadlines, rules.
Each fact comes from a spec source: the maker's spec page, the official program or policy page, a government page, an official price list. Never a forum, review, or blog.
Output only lines, one fact per line, one sentence each, under 25 words. No intro, no headers, no markdown. Never invent a number. If nothing official answers anything, output nothing.`;

// ponytail: a host list, not a real spec-page test. Catches the common opinion
// sites; a firm's blog still slips through unless its name says blog.
const OPINION = /reddit|quora|medium|youtube|tiktok|facebook|instagram|twitter|x\.com|forum|blog|substack|wordpress|stackexchange/i;

export async function askFacts(ai: GoogleGenAI, body: DecideRequest) {
  const lines = [`Decision: ${body.decision}`];
  if (body.paths) lines.push(`The options: "${body.paths.a}" and "${body.paths.b}".`);
  if (body.context?.length)
    lines.push(...body.context.slice(0, 4).map((line) => clip(line, 120) as string));
  const rows = await grounded(ai, lines.join("\n"), FACTS);
  const used = new Set<string>();
  const facts = rows.flatMap(({ line, sources }) => {
    const source = sources.find((item) => !used.has(item.url) && !OPINION.test(item.site));
    const text = cleanLine(line.replace(/^[\s*\-•\d.)]+/, ""));
    if (!source || text.length < 12) return [];
    used.add(source.url);
    return [{ text: clip(text, 200) as string, url: source.url, source: clip(source.site || "Source", 60) as string }];
  });
  return factsSchema.parse({ facts: facts.slice(0, 4) });
}

const ASK = `Someone typed a decision they are stuck on. You do not search and you do not advise.
Return JSON only.
pathA and pathB name two ways it can go, in their words, short. They must be alternatives: never two parts of the same choice.
When they already chose, pathA is the choice they made, kept as is, like "Kept biking". pathB is going back or switching, like "Got a car again". Never split what they did into two paths.
If they named three or more real options, put the rest in others, each short. Do not drop a named option. If there are only two, others is an empty list.
size is "small" when it is cheap and easy to undo, like a shirt, lunch, or a movie. Otherwise "big".
thing is true only when they are choosing between items they would wear or carry, like clothes, shoes, glasses, a bag, a watch, a phone. A car, a home, a job, a school, or a plan is false.
questions are up to three short questions that would change which posts are worth finding: their field, school, city, budget, timeline, family, the offer they have. Ask about them, not about feelings.
Each question is under ten words, plain, the way a friend would ask. No "Great question".
choices are two to four short taps when the answer is a pick. Leave choices empty when it needs their own words, like a school name.
If they sent a photo, name pathA and pathB from what is in the photo, in their words. thing is true. The two paths should be the real options that photo implies, like the item vs the other option they typed.
Big decisions always get two or three questions. Small decisions get zero. Never ask what they are afraid of missing.`;

function fitFork(value: unknown) {
  if (!value || typeof value !== "object") return value;
  const raw = value as Record<string, unknown>;
  const questions = Array.isArray(raw.questions)
    ? raw.questions.slice(0, 3).map((item) => {
        if (typeof item === "string") return { text: clip(item, 90), choices: [] };
        if (!item || typeof item !== "object") return item;
        const row = item as Record<string, unknown>;
        return {
          ...row,
          text: clip(row.text, 90),
          choices: Array.isArray(row.choices)
            ? row.choices.slice(0, 4).map((choice) => clip(choice, 40))
            : [],
        };
      })
    : [];
  const others = Array.isArray(raw.others)
    ? raw.others
        .slice(0, 4)
        .map((item) => clip(item, 80))
        .filter(
          (item): item is string => typeof item === "string" && item.length > 0,
        )
    : [];
  return {
    ...raw,
    pathA: clip(raw.pathA, 80),
    pathB: clip(raw.pathB, 80),
    others,
    questions,
  };
}

export async function askFork(ai: GoogleGenAI, body: AskRequest) {
  const seen = body.image ? await namePhoto(ai, body.image) : "";
  const lines = [
    `Decision: ${body.decision}`,
    `They have ${body.when === "already" ? "already chosen" : "not chosen yet"}.`,
  ];
  if (seen)
    lines.push(
      `They sent a photo. It is: ${seen}. Name the two paths from that item and what they typed.`,
    );
  else if (body.image)
    lines.push("They sent a photo of the thing. Name the two paths from that photo.");
  try {
    return await askJson(ai, {
      input: lines.join("\n"),
      system: ASK,
      schema: askSchema,
      fit: fitFork,
      image: seen ? undefined : body.image,
      timeout: 12_000,
      budget: 28_000,
    });
  } catch {
    return forkFrom(body.decision, Boolean(body.image));
  }
}

function fitEnough(value: unknown) {
  if (!value || typeof value !== "object") return value;
  const raw = value as Record<string, unknown>;
  const open = Array.isArray(raw.open) ? raw.open.slice(0, 3).map((item) => clip(item, 200)) : [];
  return { ...raw, sentence: clip(raw.sentence, 180), open };
}

const ENOUGH = `You check three must-haves against facts and posts already collected. You do not search. You do not invent a post.
A must-have counts as met only when a fact, or a story sentence, answers it directly for that path. A path meets all three only when each one is answered. If you cannot tell, pick neither.
open lists the must-haves, in their words, that nothing here answers. Taste and feelings, like "I'd enjoy it", are always open: only the person can answer those.
sentence is one short line a person would say. Use the path's own name from pathA or pathB, never "the first path" or "the second path". For example "Staying meets all three." or "Neither side covers all three."
No advice. Do not name a winner.`;

export function askEnough(ai: GoogleGenAI, body: EnoughRequest) {
  return askJson(ai, {
    input: JSON.stringify(body),
    system: ENOUGH,
    schema: enoughSchema,
    fit: fitEnough,
  });
}

const LEAN = `You read what someone typed while deciding. You do not advise and you do not pick for them. JSON only.
path is "a" or "b" only when their own words lean toward that path: wanting it, defending it, worrying about losing it, or doubting the other. Otherwise "none".
quote is their own words that show the lean, copied, under twelve words. Empty when path is "none".`;

function fitLean(value: unknown) {
  if (!value || typeof value !== "object") return value;
  const raw = value as Record<string, unknown>;
  const path = raw.path === "a" || raw.path === "b" ? raw.path : "none";
  const quote = typeof raw.quote === "string" ? raw.quote.trim().slice(0, 120) : "";
  return { path, quote: path === "none" ? "" : quote };
}

export function askLean(ai: GoogleGenAI, body: LeanRequest) {
  return askJson(ai, {
    input: JSON.stringify(body),
    system: LEAN,
    schema: leanSchema,
    fit: fitLean,
    timeout: 8_000,
    budget: 12_000,
  });
}

export function imageFrom(interaction: ModelReply) {
  if (interaction.output_image?.data) {
    return {
      image: interaction.output_image.data,
      mimeType: interaction.output_image.mime_type ?? "image/png",
    };
  }
  for (const step of interaction.steps ?? []) {
    if (
      step.type === "image" &&
      "data" in step &&
      typeof step.data === "string"
    ) {
      const mime =
        "mime_type" in step && typeof step.mime_type === "string"
          ? step.mime_type
          : "image/png";
      return { image: step.data, mimeType: mime };
    }
  }
  return null;
}

export function imageFromGen(response: {
  data?: string;
  candidates?: Array<{
    content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> };
  }>;
}) {
  if (response.data) return { image: response.data, mimeType: "image/png" };
  for (const part of response.candidates?.[0]?.content?.parts ?? []) {
    if (part.inlineData?.data)
      return {
        image: part.inlineData.data,
        mimeType: part.inlineData.mimeType ?? "image/png",
      };
  }
  return null;
}
