import { auth } from "@clerk/nextjs/server";
import { decisionPutSchema, listDecisions, putDecision, removeDecision } from "@/lib/decisions";

export const maxDuration = 30;

const MAX_BYTES = 2_000_000;

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Sign in first." }, { status: 401 });
  try {
    const items = await listDecisions(userId);
    if (!items) return Response.json({ error: "Add MONGODB_URI to save decisions." }, { status: 503 });
    return Response.json({ items });
  } catch (err) {
    console.error("decisions list failed", err instanceof Error ? err.message.slice(0, 180) : "");
    return Response.json({ error: "Couldn't load your decisions." }, { status: 502 });
  }
}

export async function PUT(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Sign in first." }, { status: 401 });
  const text = await request.text().catch(() => "");
  if (text.length > MAX_BYTES) return Response.json({ error: "Too big to save." }, { status: 413 });
  let raw: unknown = null;
  try {
    raw = JSON.parse(text);
  } catch {}
  const body = decisionPutSchema.safeParse(raw);
  if (!body.success) return Response.json({ error: "That decision didn't come through." }, { status: 400 });
  try {
    const ok = await putDecision(userId, body.data);
    if (!ok) return Response.json({ error: "Add MONGODB_URI to save decisions." }, { status: 503 });
    return Response.json({ ok: true });
  } catch (err) {
    console.error("decision save failed", err instanceof Error ? err.message.slice(0, 180) : "");
    return Response.json({ error: "Couldn't save that decision." }, { status: 502 });
  }
}

const ID = /^[A-Za-z0-9-]{8,80}$/;

export async function DELETE(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Sign in first." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!ID.test(id)) return Response.json({ error: "That decision didn't come through." }, { status: 400 });
  try {
    const ok = await removeDecision(userId, id);
    if (!ok) return Response.json({ error: "Add MONGODB_URI to save decisions." }, { status: 503 });
    return Response.json({ ok: true });
  } catch (err) {
    console.error("decision delete failed", err instanceof Error ? err.message.slice(0, 180) : "");
    return Response.json({ error: "Couldn't delete that decision." }, { status: 502 });
  }
}
