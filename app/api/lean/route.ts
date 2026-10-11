import { needSignIn } from "@/lib/gate";
import { askLean, gemini } from "@/lib/gemini";
import { leanRequestSchema } from "@/lib/schema";

export const maxDuration = 20;

export async function POST(request: Request) {
  const deny = await needSignIn();
  if (deny) return deny;
  const body = leanRequestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Nothing to read." }, { status: 400 });

  const ai = gemini();
  if (!ai) return Response.json({ error: "Add GEMINI_API_KEY to read this." }, { status: 503 });

  try {
    return Response.json(await askLean(ai, body.data));
  } catch (err) {
    console.error("lean failed", (err instanceof Error ? err.message : "").slice(0, 180));
    return Response.json({ error: "Could not read that." }, { status: 502 });
  }
}
