import assert from "node:assert/strict";
import { canonUrl, isPageUrl, keepLink, labelFromUrl, landedUrl, ogImage, pageTitle, uniqueStories, usableTitle } from "./dedupe.ts";
import { asStory, asWish } from "./schema.ts";

assert.equal(
  canonUrl("https://www.reddit.com/r/phd/comments/abc/?utm_source=share"),
  "https://reddit.com/r/phd/comments/abc",
);
assert.equal(canonUrl("http://reddit.com/x"), "");

const stories = uniqueStories([
  {
    url: "https://reddit.com/a",
    text: "I stayed and the stipend hurt.",
    promo: false,
  },
  {
    url: "https://www.reddit.com/a?utm_source=x",
    text: "Same post, other link.",
    promo: false,
  },
  { url: "https://example.com/ad", text: "Buy this now.", promo: true },
  {
    url: "https://blog.example/copy",
    text: "I stayed and the stipend hurt after two years of the same lab.",
    promo: false,
  },
  {
    url: "https://blog.example/copy-2",
    text: "I stayed and the stipend hurt after two years of the same lab and then some.",
    promo: false,
  },
  {
    url: "https://news.example/other",
    text: "I left and the pay was fine.",
    promo: false,
  },
]);

assert.equal(
  uniqueStories([
    { url: "", text: "Still wear it most days.", kind: "check-in" },
    { url: "", text: "Still wear it most days.", kind: "check-in" },
    { url: "https://reddit.com/a", text: "A post." },
  ]).length,
  2,
);
assert.equal(
  uniqueStories([
    { text: "Traded up and the new HW4 cameras finally worked.", kind: "sketch" },
    { text: "Traded up and the new HW4 cameras finally worked.", kind: "sketch" },
    { url: "https://reddit.com/a", text: "A post." },
  ]).length,
  2,
);

assert.deepEqual(
  stories.map((story) => story.url),
  [
    "https://reddit.com/a",
    "https://example.com/ad",
    "https://blog.example/copy",
    "https://blog.example/copy-2",
    "https://news.example/other",
  ],
);

const moved = new Map([
  [
    canonUrl("https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc"),
    "https://reddit.com/r/personalfinance/comments/x",
  ],
]);
assert.equal(
  landedUrl(
    "https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc",
    moved,
  ),
  "https://reddit.com/r/personalfinance/comments/x",
);
assert.equal(landedUrl("https://example.com/missing", moved), "https://example.com/missing");

assert.equal(keepLink(200), true);
assert.equal(keepLink(301), true);
assert.equal(keepLink(403), true);
assert.equal(keepLink(429), true);
assert.equal(keepLink(404), false);
assert.equal(keepLink(500), false);

const messy = asStory(
  {
    path: "A",
    text: "I moved and the rent hurt after a year.",
    url: "reddit.com/r/samegrassbutgreener/comments/abc",
    feeling: "Regret",
    monthsLater: "1 year",
  },
  { a: "Move to Chicago", b: "Stay in Jersey" },
);
assert.equal(messy?.path, "a");
assert.equal(messy?.feeling, "regret");
assert.equal(messy?.monthsLater, 12);
assert.ok(messy?.url.startsWith("https://"));

assert.equal(
  asStory({ path: "a", text: "No link.", feeling: "glad" }, { a: "Stay", b: "Go" }),
  null,
);

const named = asStory(
  {
    path: "Stay in Jersey",
    text: "I stayed and I was glad I did.",
    url: "https://reddit.com/r/x/comments/1",
    feeling: "glad",
  },
  { a: "Move to Chicago", b: "Stay in Jersey" },
);
assert.equal(named?.path, "b");

assert.equal(asWish({ text: "Ask about rent.", urls: ["not-a-url"] }), null);
assert.deepEqual(asWish({ text: "Ask about rent.", urls: ["https://reddit.com/r/x"] }), {
  text: "Ask about rent.",
  urls: ["https://reddit.com/r/x"],
});

assert.equal(
  ogImage('<meta property="og:image" content="https://cdn.example/pic.jpg">'),
  "https://cdn.example/pic.jpg",
);
assert.equal(
  ogImage('<meta name="og:image" content="//cdn.example/pic.jpg">'),
  "https://cdn.example/pic.jpg",
);
assert.equal(
  ogImage('<meta name="twitter:image" content="https://cdn.example/tw.jpg">'),
  "https://cdn.example/tw.jpg",
);
assert.equal(
  ogImage('{"image":"https:\\/\\/cdn.example\\/ld.jpg"}'),
  "https://cdn.example/ld.jpg",
);
assert.equal(ogImage("<p>no image</p>"), "");

const linked = asStory(
  {
    path: "b",
    title: "Returned the white tee after two washes.",
    uri: "https://reddit.com/r/malefashionadvice/comments/tee",
    image: "https://preview.redd.it/tee.jpg",
    feeling: "regret",
  },
  { a: "This white t-shirt", b: "A different shirt" },
);
assert.equal(linked?.path, "b");
assert.equal(linked?.url, "https://reddit.com/r/malefashionadvice/comments/tee");
assert.equal(linked?.image, "https://preview.redd.it/tee.jpg");
assert.ok(linked?.text.includes("white tee"));

assert.equal(isPageUrl("https://reddit.com/r/malefashionadvice/comments/tee"), true);
assert.equal(isPageUrl("https://cdn.example/4219090-DETAILED.jpg"), false);
assert.equal(usableTitle("Returned the white tee after two washes."), true);
assert.equal(usableTitle("AUZIYQH77iTVkF64MjjGFlgegXrs5rvsp"), false);
assert.equal(usableTitle("4219090 p DETAILED.jpg"), false);
assert.equal(usableTitle("A later post"), false);
assert.equal(usableTitle("reddit.com"), false);
assert.equal(usableTitle("AUZIYQGPDWR8ZXNMKfm11fj3g9tStxav9u24ny1iNCIDOc6w oH0hNrviwiOZ2eh"), false);
assert.equal(
  labelFromUrl("https://reddit.com/r/malefashionadvice/comments/abc/best_white_tees_after_a_year"),
  "best white tees after a year",
);
assert.equal(
  pageTitle('<meta property="og:title" content="Best white tees after a year">'),
  "Best white tees after a year",
);
