export type Source = { url: string; site: string };
export type Support = { segment?: { text?: string }; groundingChunkIndices?: number[] };
export type Found = {
  path: "a" | "b";
  feeling: "glad" | "regret" | "mixed" | "unclear";
  monthsLater?: number;
  text: string;
  url: string;
  site: string;
};

// A line keeps only the pages Google says it came from. No source, no line.
export function sourced(text: string, chunks: Source[], supports: Support[]) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.map((line) => {
    const picked = new Set<number>();
    for (const support of supports) {
      const seg = support.segment?.text?.trim();
      if (!seg || seg.length < 12) continue;
      if (!line.includes(seg) && !seg.includes(line)) continue;
      for (const i of support.groundingChunkIndices ?? []) picked.add(i);
    }
    return {
      line,
      sources: [...picked].flatMap((i) => (chunks[i]?.url ? [chunks[i]] : [])),
    };
  });
}

export type Cite = { url: string; start: number; end: number };

// OpenAI marks which characters each link backs. A line keeps the links inside it.
export function cited(text: string, cites: Cite[]) {
  const out: { line: string; sources: Source[] }[] = [];
  let at = 0;
  for (const raw of text.split("\n")) {
    const start = at;
    const end = at + raw.length;
    at = end + 1;
    const line = raw.trim();
    if (!line) continue;
    const seen = new Set<string>();
    const sources = cites.flatMap((cite) => {
      if (cite.end <= start || cite.start >= end || seen.has(cite.url)) return [];
      seen.add(cite.url);
      let site = "";
      try {
        site = new URL(cite.url).hostname.replace(/^www\./, "");
      } catch {
        return [];
      }
      return [{ url: cite.url, site }];
    });
    out.push({ line, sources });
  }
  return out;
}

export function cleanLine(line: string) {
  return line
    .replace(/\s*\(\[[^\]]*\]\([^)]*\)\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\s*\[\d+(?:,\s*\d+)*\]\s*/g, " ")
    .replace(/\*+/g, "")
    .trim();
}

const STORY = /^[\s*\-•\d.)]*\**\s*([AB])\s*\**\s*;\s*(glad|regret|mixed|unclear)\s*;\s*([\d.]+|\?)[^;]*;\s*(.+)$/i;

// Lines the model has finished. The last line stays out until a newline, unless this is the end.
export function freshStories(text: string, seen: Set<string>, final = false) {
  const parts = text.split("\n");
  const lines = final || text.endsWith("\n") ? parts : parts.slice(0, -1);
  const out: NonNullable<ReturnType<typeof storyOf>>[] = [];
  for (const line of lines) {
    const story = storyOf(line);
    if (!story || seen.has(story.text)) continue;
    seen.add(story.text);
    out.push(story);
  }
  return out;
}

export function storyOf(line: string) {
  const match = line.match(STORY);
  if (!match) return null;
  const months = parseFloat(match[3]);
  const text = cleanLine(match[4]);
  if (text.length < 12) return null;
  return {
    path: match[1].toLowerCase() as "a" | "b",
    feeling: match[2].toLowerCase() as Found["feeling"],
    ...(Number.isFinite(months) ? { monthsLater: Math.min(600, Math.round(months)) } : {}),
    text: text.slice(0, 400),
  };
}

// One page backs one story. A second line on the same page tries its next source.
export function pickStories(
  rows: { line: string; sources: Source[] }[],
  max = 20,
): Found[] {
  const used = new Set<string>();
  const out: Found[] = [];
  for (const row of rows) {
    const story = storyOf(row.line);
    if (!story) continue;
    const source = row.sources.find((item) => !used.has(item.url));
    if (!source) continue;
    used.add(source.url);
    out.push({ ...story, url: source.url, site: source.site });
    if (out.length >= max) break;
  }
  return out;
}
