import { needSignIn } from "@/lib/gate";
import { askFork, gemini } from "@/lib/gemini";
import { askRequestSchema } from "@/lib/schema";

export const maxDuration = 60;

export async function POST(request: Request) {
  const deny = await needSignIn();
  if (deny) return deny;
  const body = askRequestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return Response.json({ error: "Say what you're stuck on." }, { status: 400 });
  }

  const ai = gemini();
  if (!ai) {
    return Response.json({ error: "Add GEMINI_API_KEY to start." }, { status: 503 });
  }

  try {
    return Response.json(await askFork(ai, body.data));
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    console.error("ask failed", message.slice(0, 180));
    const error = message.startsWith("429")
      ? "Too many looks right now. Try again in a minute."
      : "Could not read that.";
    return Response.json({ error }, { status: 502 });
  }
}
