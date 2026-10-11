import { cited, type Cite } from "@/lib/lines";

type SearchHooks = {
  onText?: (text: string, final: boolean) => void;
  onRows?: (rows: { line: string; sources: { url: string; site: string }[] }[]) => void;
};

export const OPENAI_MODEL = "gpt-5.4-mini";

// ponytail: one process-wide pause after a billing/quota error, so every call
// doesn't pay a failed round trip first. Resets on cold start or after 10 min.
let pausedUntil = 0;

export function openaiReady() {
  return Boolean(process.env.OPENAI_API_KEY) && Date.now() > pausedUntil;
}

type Reply = {
  error?: { message?: string };
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
      annotations?: Array<{ type?: string; url?: string; start_index?: number; end_index?: number }>;
    }>;
  }>;
};

function inputOf(text: string, image?: string) {
  if (!image) return text;
  const url = image.startsWith("data:") ? image : `data:image/jpeg;base64,${image}`;
  return [
    {
      role: "user",
      content: [
        { type: "input_text", text },
        { type: "input_image", image_url: url },
      ],
    },
  ];
}

async function respond(body: Record<string, unknown>, ms: number) {
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model: OPENAI_MODEL, reasoning: { effort: "low" }, ...body }),
    signal: AbortSignal.timeout(ms),
  });
  const data = (await res.json().catch(() => ({}))) as Reply;
  if (!res.ok || data.error) {
    const message = data.error?.message ?? "";
    noteQuota(res.status, message);
    throw new Error(`openai ${res.status} ${message}`.slice(0, 200));
  }
  const { text, cites } = readReply(data);
  if (!text.trim())
    throw new Error(`openai empty reply ${JSON.stringify({ status: (data as { status?: string }).status, why: (data as { incomplete_details?: unknown }).incomplete_details, kinds: data.output?.map((o) => o.type) }).slice(0, 200)}`);
  return { text, cites };
}

function noteQuota(status: number, message: string) {
  if (status === 429 || status === 401 || /credit|quota|billing/i.test(message))
    pausedUntil = Date.now() + 10 * 60_000;
}

export async function openaiSearch(
  input: string,
  system: string,
  image?: string,
  hooks?: SearchHooks,
) {
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      reasoning: { effort: "low" },
      stream: true,
      instructions: `${system}\nEnd every line with a citation to the one page it came from. A line without a citation is dropped.`,
      input: inputOf(input, image),
      tools: [{ type: "web_search" }],
    }),
    signal: AbortSignal.timeout(55_000),
  });
  if (!res.ok || !res.body) {
    const data = (await res.json().catch(() => ({}))) as Reply;
    const message = data.error?.message ?? "";
    noteQuota(res.status, message);
    throw new Error(`openai ${res.status} ${message}`.slice(0, 200));
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let text = "";
  const cites: Cite[] = [];
  let citedCount = 0;
  const emitRows = (final: boolean) => {
    let rows = cited(text, cites);
    if (!final && !text.endsWith("\n")) rows = rows.slice(0, -1);
    const sourced = rows.filter((row) => row.sources.length > 0).length;
    if (sourced > citedCount) {
      citedCount = sourced;
      hooks?.onRows?.(rows);
    }
  };
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split("\n");
    buf = parts.pop() ?? "";
    for (const part of parts) {
      const data = part.trim().replace(/^data:\s*/, "");
      if (!data || data === "[DONE]" || !part.trim().startsWith("data:")) continue;
      let json: {
        type?: string;
        delta?: string;
        annotation?: { type?: string; url?: string; start_index?: number; end_index?: number };
        response?: Reply;
        error?: { message?: string };
      };
      try {
        json = JSON.parse(data) as typeof json;
      } catch {
        continue;
      }
      if (json.type === "error" || json.error) {
        const message = json.error?.message ?? "stream failed";
        noteQuota(429, message);
        throw new Error(`openai ${message}`.slice(0, 200));
      }
      if (json.type === "response.output_text.delta" && json.delta) {
        text += json.delta;
        hooks?.onText?.(text, false);
        emitRows(false);
      }
      const note = json.annotation;
      if (json.type === "response.output_text.annotation.added" && note?.type === "url_citation" && note.url) {
        cites.push({ url: note.url, start: note.start_index ?? 0, end: note.end_index ?? 0 });
        emitRows(false);
      }
      if (json.type === "response.completed" && json.response) {
        const full = readReply(json.response);
        if (full.text) text = full.text;
        cites.push(...full.cites);
      }
    }
  }
  hooks?.onText?.(text, true);
  const rows = cited(text, cites);
  if (rows.length) hooks?.onRows?.(rows);
  if (!text.trim()) throw new Error("openai empty reply");
  return rows;
}

function readReply(data: Reply) {
  let text = "";
  const cites: Cite[] = [];
  for (const item of data.output ?? []) {
    if (item.type !== "message") continue;
    for (const part of item.content ?? []) {
      if (part.type !== "output_text" || typeof part.text !== "string") continue;
      for (const note of part.annotations ?? []) {
        if (note.type === "url_citation" && note.url)
          cites.push({
            url: note.url,
            start: text.length + (note.start_index ?? 0),
            end: text.length + (note.end_index ?? 0),
          });
      }
      text += part.text;
    }
  }
  return { text, cites };
}

export async function openaiJson(input: string, system: string, ms: number, image?: string, schema?: unknown) {
  const format = schema
    ? { type: "json_schema", name: "answer", schema, strict: false }
    : { type: "json_object" };
  const out = await respond(
    { instructions: system, input: inputOf(`${input}\n\nReply in JSON.`, image), text: { format } },
    ms,
  );
  return out.text;
}
