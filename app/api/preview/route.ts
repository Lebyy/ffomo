import { needSignIn } from "@/lib/gate";
import { gemini, IMAGE_MODELS, imageFrom, imageFromGen } from "@/lib/gemini";
import { previewRequestSchema } from "@/lib/schema";

export const maxDuration = 60;

function promptOf(caption: string, kind?: "face" | "item") {
  const who =
    kind === "item"
      ? "Edit this exact uploaded item. Keep the same object, color, material, and shape. Do not swap in a different product."
      : "Edit this photo of the same person. Keep the same face, age, and hair.";
  return `${who} ${caption} No extra money, cars, or status. No baldness, tears, or distress unless the note says so. Funny is fine. Mean is not. No insults. No words on the image. This is not a prediction.`;
}

export async function POST(request: Request) {
  const deny = await needSignIn();
  if (deny) return deny;
  const body = previewRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!body.success) {
    return Response.json(
      { error: "That photo didn't come through." },
      { status: 400 },
    );
  }

  const ai = gemini();
  if (!ai) {
    return Response.json(
      { error: "Add GEMINI_API_KEY to draw from a photo." },
      { status: 503 },
    );
  }

  const data = body.data.image.replace(
    /^data:image\/[a-z0-9.+-]+;base64,/i,
    "",
  );
  const text = promptOf(body.data.caption, body.data.kind);

  for (const model of IMAGE_MODELS) {
    try {
      const interaction = await ai.interactions.create({
        model,
        store: false,
        input: [
          { type: "text", text },
          { type: "image", data, mime_type: body.data.mimeType },
        ],
      });
      const image = imageFrom(interaction);
      if (image) return Response.json(image);
    } catch {
      /* try generateContent on the same model */
    }
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [
          { text },
          { inlineData: { mimeType: body.data.mimeType, data } },
        ],
        config: { responseModalities: ["IMAGE", "TEXT"] },
      });
      const image = imageFromGen(response);
      if (image) return Response.json(image);
    } catch {
      /* try the next image model */
    }
  }
  return Response.json({ error: "Couldn't draw that." }, { status: 502 });
}
