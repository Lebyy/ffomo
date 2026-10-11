import { needSignIn } from "@/lib/gate";

const VOICE = "21m00Tcm4TlvDq8ikWAM";

export const maxDuration = 30;

export async function POST(request: Request) {
  const deny = await needSignIn();
  if (deny) return deny;
  const body = (await request.json().catch(() => null)) as { text?: string } | null;
  const text = body?.text?.trim().slice(0, 400) ?? "";
  if (!text) return Response.json({ error: "Nothing to say." }, { status: 400 });

  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    return Response.json({ error: "Add ELEVENLABS_API_KEY to talk." }, { status: 503 });
  }

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": key,
        "content-type": "application/json",
        accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_flash_v2_5",
        voice_settings: { stability: 0.4, similarity_boost: 0.7 },
      }),
    },
  );
  if (!res.ok) {
    return Response.json({ error: "Couldn't speak that." }, { status: 502 });
  }
  return new Response(res.body, {
    headers: {
      "content-type": "audio/mpeg",
      "cache-control": "no-store",
    },
  });
}
