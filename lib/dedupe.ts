// Host is there; it just won't serve our server. The person can still open it.
function absHttps(href: string) {
  let next = href.trim();
  if (!next) return "";
  if (next.startsWith("//")) next = `https:${next}`;
  try {
    const parsed = new URL(next);
    return parsed.protocol === "https:" ? parsed.toString() : "";
  } catch {
    return "";
  }
}

export function ogImage(html: string) {
  const tags = [
    html.match(/<meta\s+[^>]*(?:property|name)=["']og:image(?::url)?["'][^>]*>/i)?.[0],
    html.match(/<meta\s+[^>]*(?:property|name)=["']twitter:image(?::src)?["'][^>]*>/i)?.[0],
    html.match(/<link\s+[^>]*rel=["']image_src["'][^>]*>/i)?.[0],
  ];
  for (const tag of tags) {
    if (!tag) continue;
    const href =
      tag.match(/content=["']([^"']+)["']/i)?.[1] ??
      tag.match(/href=["']([^"']+)["']/i)?.[1] ??
      "";
    const url = absHttps(href);
    if (url) return url;
  }
  const raw =
    html.match(/"image"\s*:\s*"(https:\\?\/\\?\/[^"]+)"/i)?.[1]?.replace(
      /\\u002f/gi,
      "/",
    ) ?? "";
  const fromJson = absHttps(raw.replace(/\\\//g, "/"));
  if (fromJson) return fromJson;
  for (const match of html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi)) {
    const url = absHttps(match[1]);
    if (!url) continue;
    if (/sprite|icon|logo|pixel|1x1|avatar|emoji|badge|data:image/i.test(url)) continue;
    try {
      const path = new URL(url).pathname;
      if (/\.(jpg|jpeg|png|webp)(\?|$)/i.test(path) || /preview\.redd\.it|i\.redd\.it|imgur\.com/i.test(url))
        return url;
    } catch {
      /* skip */
    }
  }
  return "";
}

function decode(text: string) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function pageTitle(html: string) {
  const tag =
    html.match(/<meta\s+[^>]*(?:property|name)=["']og:title["'][^>]*>/i)?.[0] ?? "";
  const og = tag.match(/content=["']([^"']+)["']/i)?.[1] ?? "";
  if (og.trim()) return decode(og).slice(0, 400);
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? "";
  return decode(title).slice(0, 400);
}

export function isPageUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    if (/\.(jpg|jpeg|png|gif|webp|svg|css|js|mjs|woff2?|mp4|webm)(\?|$)/i.test(parsed.pathname))
      return false;
    return true;
  } catch {
    return false;
  }
}

export function usableTitle(text: string) {
  const t = text.trim();
  if (t.length < 8) return false;
  if (/^(a )?later post$/i.test(t)) return false;
  if (/^[a-z0-9-]+(\.[a-z]{2,})+$/i.test(t)) return false;
  if (/^AUZIY/i.test(t)) return false;
  if (t.split(/\s+/).filter((word) => word.length > 16).length >= 2) return false;
  if (/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(t)) return false;
  if (/^[A-Za-z0-9+/_=-]{20,}$/.test(t)) return false;
  if (!/[aeiou ]/i.test(t)) return false;
  const letters = t.replace(/[^a-z]/gi, "");
  if (letters.length < 6) return false;
  return true;
}

export function labelFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const comments = parts.indexOf("comments");
    if (/reddit\.com$/i.test(parsed.hostname) && comments >= 0) {
      const slug = (parts[comments + 2] ?? "").replace(/[_-]+/g, " ");
      if (usableTitle(slug)) return slug;
    }
    const last = (parts.at(-1) ?? "").replace(/[_-]+/g, " ");
    if (usableTitle(last)) return last;
    return "";
  } catch {
    return "";
  }
}

export function keepLink(status: number) {
  return (status >= 200 && status < 400) || status === 401 || status === 403 || status === 429;
}

export function landedUrl(url: string, moved: Map<string, string>) {
  return moved.get(canonUrl(url)) ?? canonUrl(url);
}

export function canonUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return "";
    parsed.hash = "";
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid)/i.test(key)) parsed.searchParams.delete(key);
    }
    parsed.hostname = parsed.hostname.replace(/^www\./, "");
    if (parsed.pathname.length > 1)
      parsed.pathname = parsed.pathname.replace(/\/$/, "");
    return parsed.toString();
  } catch {
    return "";
  }
}

export function uniqueStories<
  T extends { url?: string; text: string; promo?: boolean; kind?: string },
>(stories: T[]) {
  const seenUrl = new Set<string>();
  const seenCheck = new Set<string>();
  const kept: T[] = [];
  for (const story of stories) {
    if (story.kind === "check-in" || story.kind === "sketch" || !story.url) {
      const key = `${story.text}\0${story.url ?? ""}`;
      if (seenCheck.has(key)) continue;
      seenCheck.add(key);
      kept.push(story);
      continue;
    }
    const url = canonUrl(story.url ?? "");
    if (!url || seenUrl.has(url)) continue;
    seenUrl.add(url);
    kept.push(story);
  }
  return kept;
}
