import { needSignIn } from "@/lib/gate";
import { saveRecord, recordRequestSchema } from "@/lib/records";

export const maxDuration = 30;

export async function POST(request: Request) {
  const deny = await needSignIn();
  if (deny) return deny;
  const body = recordRequestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return Response.json({ error: "That check-in didn't come through." }, { status: 400 });
  }
  try {
    const ok = await saveRecord(body.data);
    if (!ok) return Response.json({ error: "Add MONGODB_URI to save a check-in." }, { status: 503 });
    return Response.json({ ok: true });
  } catch (err) {
    console.error("record failed", err instanceof Error ? err.message.slice(0, 180) : "");
    return Response.json({ error: "Couldn't save that check-in." }, { status: 502 });
  }
}
