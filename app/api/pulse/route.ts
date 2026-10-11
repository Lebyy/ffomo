import { needSignIn } from "@/lib/gate";
import { feedPulse, startPulse, stopPulse } from "@/lib/pulse";

export const maxDuration = 60;

const ID = /^[0-9a-f-]{36}$/;

// POST /api/pulse          start a read
// POST /api/pulse?id=…     binary frames, returns readings so far
// DELETE /api/pulse?id=…   end the read, frames are dropped
export async function POST(request: Request) {
  const deny = await needSignIn();
  if (deny) return deny;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    const started = await startPulse();
    if ("busy" in started) {
      return Response.json({ error: "Someone else is on a pulse read. Try in a minute." }, { status: 409 });
    }
    if ("off" in started) return Response.json({ error: started.off }, { status: 503 });
    return Response.json(started);
  }
  if (!ID.test(id)) return Response.json({ error: "Bad read." }, { status: 400 });
  const body = await request.arrayBuffer();
  if (body.byteLength > 8_000_000) return Response.json({ error: "Too much at once." }, { status: 413 });
  const state = feedPulse(id, body);
  if (!state) return Response.json({ error: "That read ended." }, { status: 410 });
  return Response.json(state);
}

export async function DELETE(request: Request) {
  const deny = await needSignIn();
  if (deny) return deny;
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!ID.test(id)) return Response.json({ error: "Bad read." }, { status: 400 });
  const state = await stopPulse(id);
  return Response.json(state ?? { readings: [], hint: "", error: "" });
}
