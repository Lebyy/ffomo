import { canonUrl, keepLink, labelFromUrl, landedUrl, ogImage, pageTitle, uniqueStories, usableTitle } from "@/lib/dedupe";
import { storyStrength } from "@/lib/strength";
import {
  decideSchema,
  type Beat,
  type DecideResult,
  type Fact,
  type Wish,
  type SideMeter,
  type Story,
} from "@/lib/schema";

function httpsUrl(url: string) {
  return canonUrl(url) !== "";
}

// Search grounding hands back redirect links. Keep where they land, or "" if they don't.
export async function linkLoads(url: string) {
  const page = await peekPage(url);
  return page.url;
}

async function peekPage(url: string) {
  if (!httpsUrl(url)) return { url: "" };
  const original = canonUrl(url);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(6000),
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:131.0) Gecko/20100101 Firefox/131.0",
      },
    });
    if (!keepLink(res.status)) {
      await res.body?.cancel();
      return { url: "" };
    }
    if (!res.ok || !res.body) {
      await res.body?.cancel();
      return { url: canonUrl(res.url) || original };
    }
    const read = res.body.getReader();
    const dec = new TextDecoder();
    let html = "";
    while (html.length < 80_000) {
      const chunk = await read.read();
      if (chunk.done) break;
      html += dec.decode(chunk.value, { stream: true });
    }
    await read.cancel();
    const landed = canonUrl(res.url) || original;
    const image = ogImage(html);
    const title = pageTitle(html);
    return {
      url: landed,
      ...(image ? { image } : {}),
      ...(title ? { title } : {}),
    };
  } catch {
    return { url: original };
  }
}

function meter(stories: Story[], path: "a" | "b"): SideMeter {
  // Sketches are common patterns, not posts, so they never count in the meter.
  const side = stories.filter((story) => story.path === path && story.kind !== "sketch");
  return {
    glad: side.filter((story) => story.feeling === "glad").length,
    regret: side.filter((story) => story.feeling === "regret").length,
    mixed: side.filter((story) => story.feeling === "mixed").length,
    unclear: side.filter((story) => story.feeling === "unclear").length,
    strength: side.reduce((sum, story) => sum + story.strength, 0),
  };
}

function beatsFor(beats: Beat[], urls: Set<string>) {
  return beats.filter((beat) => urls.has(beat.url));
}

// A wish line keeps only the links that survived. No link left, no line.
export function backedWish(wish: Wish[], urls: Set<string>) {
  return wish
    .map((item) => ({ ...item, urls: [...new Set(item.urls.map(canonUrl))].filter((url) => urls.has(url)) }))
    .filter((item) => item.urls.length > 0)
    .toSorted((x, y) => y.urls.length - x.urls.length);
}

export async function withLinks(
  raw: unknown,
  facts: Fact[] = [],
  onStory?: (story: Story, original?: string) => void,
  onDrop?: (url: string) => void,
): Promise<DecideResult> {
  const parsed = decideSchema.parse(raw);
  const candidates = uniqueStories(parsed.stories);
  const moved = new Map<string, string>();
  const [checks, factChecks] = await Promise.all([
    Promise.all(
      candidates.map(async (story) => {
        if (!story.url) {
          const next = { ...story, strength: storyStrength(story.monthsLater) };
          onStory?.(next, story.url);
          return next;
        }
        const page = await peekPage(story.url);
        if (!page.url) {
          onDrop?.(story.url);
          return null;
        }
        moved.set(canonUrl(story.url), page.url);
        const host = (() => {
          try {
            return new URL(page.url).hostname.replace(/^www\./, "");
          } catch {
            return "";
          }
        })();
        const fromUrl = labelFromUrl(page.url);
        const text = usableTitle(story.text)
          ? story.text
          : page.title && usableTitle(page.title)
            ? page.title
            : fromUrl || (usableTitle(host) ? host : story.text);
        const next = {
          ...story,
          url: page.url,
          text,
          ...(page.image ? { image: page.image } : {}),
          strength: storyStrength(story.monthsLater),
        };
        onStory?.(next, story.url);
        return next;
      }),
    ),
    Promise.all(
      facts.map(async (fact) => {
        const url = await linkLoads(fact.url);
        return url ? { ...fact, url } : null;
      }),
    ),
  ]);
  const stories: Story[] = uniqueStories(
    checks.flatMap((story) => (story ? [story] : [])),
  ).map((story) => ({ ...story, strength: storyStrength(story.monthsLater) }));
  const loaded = new Set(
    stories.flatMap((story) => (story.url ? [story.url] : [])),
  );
  const landed = (url: string) => landedUrl(url, moved);
  const beats = (list: Beat[]) => list.map((beat) => ({ ...beat, url: landed(beat.url) }));
  const wish = parsed.wish.map((item) => ({ ...item, urls: item.urls.map(landed) }));
  const urls = {
    a: new Set(
      stories.flatMap((story) => (story.path === "a" && story.url ? [story.url] : [])),
    ),
    b: new Set(
      stories.flatMap((story) => (story.path === "b" && story.url ? [story.url] : [])),
    ),
  };
  const empty = stories.length === 0;
  const futureA = empty ? [] : beatsFor(beats(parsed.futureA), urls.a);
  const futureB = empty ? [] : beatsFor(beats(parsed.futureB), urls.b);
  const at = (list: Beat[], other: Beat[]) => list.filter((beat) => other.some((x) => x.when === beat.when));
  return {
    pathA: parsed.pathA,
    pathB: parsed.pathB,
    stories,
    wish: empty ? [] : backedWish(wish, loaded),
    futureA: at(futureA, futureB),
    futureB: at(futureB, futureA),
    meter: { a: meter(stories, "a"), b: meter(stories, "b") },
    facts: factChecks.flatMap((fact) => (fact ? [fact] : [])),
    factsAt: Date.now(),
    skipped: parsed.skipped,
    dropped: parsed.stories.length - stories.length,
    unknown: parsed.unknown,
  };
}
