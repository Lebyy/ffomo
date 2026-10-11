import type { Fork } from "@/lib/schema";

function cut(text: string, max: number) {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) return "";
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

// When Gemini misses, still name two paths from what they typed.
export function forkFrom(text: string, photo: boolean): Fork {
  const cleaned = text.replace(/\s+/g, " ").trim();
  const or = cleaned.split(/\s+(?:or|vs\.?|versus)\s+/i);
  let a = or[0] ?? cleaned;
  let b = or[1] ?? "";
  if (!b) {
    const but = cleaned.split(/\s+but\s+/i);
    if (but[1]) {
      a = but[0] ?? cleaned;
      b = but[1];
    }
  }
  return {
    pathA: cut(a.replace(/^[,;:\s]+|[,;:\s]+$/g, ""), 80) || "This",
    pathB: cut(b.replace(/^[,;:\s]+|[,;:\s]+$/g, ""), 80) || "The other way",
    others: [],
    size: "big",
    thing: photo,
    questions: [],
  };
}
