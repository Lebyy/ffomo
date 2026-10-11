import { canonUrl } from "@/lib/dedupe";
import { needSignIn } from "@/lib/gate";
import { askDecision, askFacts, gemini } from "@/lib/gemini";
import { withLinks } from "@/lib/links";
import type { Found } from "@/lib/lines";
import { findRecords, mixRecords } from "@/lib/records";
import { decideRequestSchema, type Story } from "@/lib/schema";
import { storyStrength } from "@/lib/strength";

export const maxDuration = 300;

function failure(err: unknown) {
  const message = err instanceof Error ? err.message : "";
  console.error("decide failed", message.slice(0, 300));
  if (/\b429\b|quota/i.test(message)) return "Search hit its limit. Try again in a minute.";
  if (/\b50[34]\b|high demand|timed out|timeout|abort/i.test(message))
    return "Search is busy. Try again in a minute.";
  return "Couldn't read that search.";
}

// One line of JSON per event, so the phone shows the search as it happens.
export async function POST(request: Request) {
  const deny = await needSignIn();
  if (deny) return deny;
  const body = decideRequestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return Response.json({ error: "Say what you're stuck on." }, { status: 400 });
  }

  const ai = gemini();
  if (!ai) {
    return Response.json({ error: "Add GEMINI_API_KEY to run a search." }, { status: 503 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const send = (event: Record<string, unknown>) => {
        if (open) controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };
      try {
        // Facts are a second grounded search. If it fails the screen says unchecked.
        const factsPending =
          body.data.size === "small"
            ? Promise.resolve({ facts: [] })
            : askFacts(ai, body.data).catch((err: unknown) => {
                console.error("facts failed", (err instanceof Error ? err.message : "").slice(0, 180));
                return { facts: [] };
              });
        const ready = new Set<string>();
        const shown = new Set<string>();
        const urlKey = new Map<string, string>();
        const card = (story: Story & { opening?: boolean }, key: string) => {
          send({ type: "story", key, story });
          if (!story.url) return;
          const canon = canonUrl(story.url);
          if (canon) urlKey.set(canon, key);
        };
        const publishFound = (story: Found) => {
          ready.add(story.text);
          const canon = canonUrl(story.url);
          if (canon) urlKey.set(canon, story.text);
          card(
            {
              path: story.path,
              feeling: story.feeling,
              text: story.text,
              url: story.url,
              ...(story.monthsLater != null ? { monthsLater: story.monthsLater } : {}),
              strength: storyStrength(story.monthsLater),
            },
            story.text,
          );
        };
        const raw = await askDecision(
          ai,
          body.data,
          (event) => send({ type: "progress", ...event }),
          {
            onOpen(story) {
              if (ready.has(story.text) || shown.has(story.text)) return;
              shown.add(story.text);
              card(
                {
                  path: story.path,
                  feeling: story.feeling,
                  text: story.text,
                  ...(story.monthsLater != null ? { monthsLater: story.monthsLater } : {}),
                  strength: storyStrength(story.monthsLater),
                  opening: true,
                },
                story.text,
              );
            },
            onFound(stories) {
              for (const story of stories) publishFound(story);
            },
            onMiss(text) {
              if (ready.has(text)) return;
              send({ type: "drop", key: text });
            },
          },
        );
        send({ type: "checking" });
        const [facts, ours] = await Promise.all([
          factsPending,
          findRecords(body.data.decision, raw.pathA, raw.pathB).catch(() => []),
        ]);
        const checked = await withLinks(
          raw,
          facts.facts,
          (story, original) => {
            const key =
              (original && urlKey.get(canonUrl(original))) ||
              (story.url && urlKey.get(canonUrl(story.url))) ||
              story.text;
            card(story, key);
          },
          (url) => {
            const key = urlKey.get(canonUrl(url)) ?? url;
            ready.delete(key);
            send({ type: "drop", key });
          },
        );
        const result = mixRecords(checked, ours);
        send({ type: "done", result });
      } catch (err) {
        send({ type: "error", error: failure(err) });
      } finally {
        open = false;
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    },
  });
}
