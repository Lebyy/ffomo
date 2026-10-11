import { needSignIn } from "@/lib/gate";
import { askEnough, gemini } from "@/lib/gemini";
import { enoughRequestSchema } from "@/lib/schema";

export const maxDuration = 30;

export async function POST(request: Request) {
  const deny = await needSignIn();
  if (deny) return deny;
  const body = enoughRequestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return Response.json({ error: "Say the three things." }, { status: 400 });
  }

  const ai = gemini();
  if (!ai) {
    return Response.json(
      { error: "Add GEMINI_API_KEY to check this." },
      { status: 503 },
    );
  }

  try {
    const result = await askEnough(ai, body.data);
    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    console.error("enough failed", message.slice(0, 180));
    return Response.json({ error: "Could not check that." }, { status: 502 });
  }
}
