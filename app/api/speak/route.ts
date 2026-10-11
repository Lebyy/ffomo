import { needSignIn } from "@/lib/gate";

const VOICE = "21m00Tcm4TlvDq8ikWAM";
const FORMAT = "mp3_22050_32";

export const maxDuration = 30;

function speakError(raw: string) {
  try {
    const data = JSON.parse(raw) as {
      detail?: { message?: string } | string;
      message?: string;
    };
    if (typeof data.detail === "string") return data.detail;
    if (data.detail && typeof data.detail.message === "string") return data.detail.message;
    if (typeof data.message === "string") return data.message;
  } catch {
    /* plain text from the provider */
  }
  return raw.replace(/\s+/g, " ").trim();
}

async function askVoice(key: string, text: string, model: string) {
  return fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=${FORMAT}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": key,
        "content-type": "application/json",
        accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: model,
        voice_settings: { stability: 0.4, similarity_boost: 0.7 },
      }),
    },
  );
}

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

  let res = await askVoice(key, text, "eleven_flash_v2_5");
  if (!res.ok) {
    const message = speakError(await res.text()).slice(0, 180);
    const retry = /model|not found|not allowed|subscription/i.test(message);
    if (!retry) {
      console.error("elevenlabs", res.status, message);
      return Response.json({ error: message || "Couldn't speak that." }, { status: 502 });
    }
    res = await askVoice(key, text, "eleven_turbo_v2_5");
    if (!res.ok) {
      const again = speakError(await res.text()).slice(0, 180);
      console.error("elevenlabs", res.status, again);
      return Response.json({ error: again || message || "Couldn't speak that." }, { status: 502 });
    }
  }

  const audio = await res.arrayBuffer();
  if (audio.byteLength < 32) {
    return Response.json({ error: "ElevenLabs sent no audio." }, { status: 502 });
  }
  return new Response(audio, {
    headers: {
      "content-type": "audio/mpeg",
      "cache-control": "no-store",
    },
  });
}
