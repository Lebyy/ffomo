export type PetKind = "pup" | "cat" | "duck" | "frog" | "dino" | "owl";

export const PET_KINDS: PetKind[] = ["pup", "cat", "duck", "frog", "dino", "owl"];

const BODY = [
  ".obbbbbbbbbbbbo.",
  ".obbeebbbbeebbo.",
  ".obbeebbbbeebbo.",
  ".obpbbbaabbbpbo.",
  ".obbbbbbbbbbbbo.",
  "..obbbbbbbbbbo..",
  "..obllllllllbo..",
  "..obllllllllbo..",
  "..obbbbbbbbbbo..",
  "...obbo..obbo...",
  "...oooo..oooo...",
];

const HEAD = "..obbbbbbbbbbo..";

const TOPS: Record<PetKind, string[]> = {
  pup: ["................", "..ooo......ooo..", ".oddo......oddo.", ".oddooooooooddo.", ".oddbbbbbbbbddo."],
  cat: ["..oo........oo..", "..obo......obo..", "..obbo....obbo..", "...oooooooooo...", HEAD],
  duck: ["................", ".......oo.......", "......obbo......", "...oooooooooo...", HEAD],
  frog: ["................", "..oooo....oooo..", ".obbbbo..obbbbo.", "..oooooooooooo..", HEAD],
  dino: ["................", "................", "...oaaoaaoaao...", "...oooooooooo...", HEAD],
  owl: ["..o..........o..", "..oo........oo..", "..obo......obo..", "...oooooooooo...", HEAD],
};

const BEAKS: Partial<Record<PetKind, string>> = {
  duck: ".obpbbaaaabbpbo.",
};

export const PALETTES: Record<PetKind, Record<string, string>> = {
  pup: { o: "#151a2b", b: "#f6f1e7", l: "#ffffff", d: "#b9773b", a: "#151a2b", p: "#ff9db1", e: "#151a2b" },
  cat: { o: "#151a2b", b: "#ffb347", l: "#ffe4b5", d: "#e8892a", a: "#ff7d93", p: "#ff9db1", e: "#151a2b" },
  duck: { o: "#151a2b", b: "#ffd94a", l: "#fff4b8", d: "#e3b82a", a: "#ff8a2b", p: "#ffb0a0", e: "#151a2b" },
  frog: { o: "#151a2b", b: "#5fd37b", l: "#cdf7cc", d: "#2f9550", a: "#2f9550", p: "#ff9db1", e: "#151a2b" },
  dino: { o: "#151a2b", b: "#7ba8ff", l: "#d3e2ff", d: "#4d7fe0", a: "#ff6fa0", p: "#ff9db1", e: "#151a2b" },
  owl: { o: "#151a2b", b: "#a97dff", l: "#e6d8ff", d: "#7d52d8", a: "#ffb347", p: "#ff9db1", e: "#151a2b" },
};

export function spriteOf(kind: PetKind) {
  const body = BODY.slice();
  const beak = BEAKS[kind];
  if (beak) body[3] = beak;
  return [...TOPS[kind], ...body];
}

export type Run = { x: number; y: number; w: number; key: string };

export function runsOf(rows: string[]) {
  const runs: Run[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const key = row[x];
      let w = 1;
      while (row[x + w] === key) w++;
      if (key !== ".") runs.push({ x, y, w, key });
      x += w;
    }
  });
  return runs;
}
