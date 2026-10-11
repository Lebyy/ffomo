import { petAt, type GalleryPet } from "@/lib/gallery";
import { PALETTES, runsOf, spriteOf, type PetKind } from "@/lib/pets";

export type Mood = "idle" | "hop" | "cheer" | "look" | "sad" | "sleep" | "walk";

const SPRITES = Object.fromEntries(
  (Object.keys(PALETTES) as PetKind[]).map((kind) => [
    kind,
    runsOf(spriteOf(kind)),
  ]),
) as Record<PetKind, ReturnType<typeof runsOf>>;

export function SheetPet({
  pet,
  size = 48,
}: {
  pet: GalleryPet;
  size?: number;
}) {
  return (
    <span
      className="sheet-pet"
      style={{ width: size, height: size, backgroundImage: `url(${pet.src})` }}
      aria-hidden
    />
  );
}

export function SeedPet({ seed, size = 48 }: { seed: string; size?: number }) {
  return <SheetPet pet={petAt(seed)} size={size} />;
}

export function Pet({
  kind,
  mood = "idle",
  size = 56,
  delay = 0,
}: {
  kind: PetKind;
  mood?: Mood;
  size?: number;
  delay?: number;
}) {
  const colors = PALETTES[kind];
  const runs = SPRITES[kind];
  const closed = mood === "sleep" || mood === "sad";
  return (
    <span
      className="pet"
      data-mood={mood}
      style={
        {
          width: size,
          height: size,
          "--pet-delay": `${delay}ms`,
        } as React.CSSProperties
      }
      aria-hidden
    >
      <span className="pet-body">
        <svg viewBox="0 -1 16 18" shapeRendering="crispEdges">
          <rect className="pet-shadow" x="3" y="16.2" width="10" height="0.8" />
          {runs.map((run) => (
            <rect
              key={`${run.x}-${run.y}`}
              x={run.x}
              y={run.y}
              width={run.w}
              height="1"
              fill={colors[run.key === "e" ? "b" : run.key]}
            />
          ))}
          <g className={closed ? "pet-eyes is-closed" : "pet-eyes"}>
            {runs
              .filter((run) => run.key === "e")
              .map((run) => (
                <rect
                  key={`e-${run.x}-${run.y}`}
                  x={run.x}
                  y={run.y}
                  width={run.w}
                  height="1"
                  fill={colors.e}
                />
              ))}
          </g>
          {mood === "sleep" ? (
            <g className="pet-z" fill="#e6ecff">
              <rect x="13" y="0" width="2" height="0.5" />
              <rect x="14" y="0.5" width="0.5" height="0.5" />
              <rect x="13.5" y="1" width="0.5" height="0.5" />
              <rect x="13" y="1.5" width="2" height="0.5" />
            </g>
          ) : null}
          {mood === "cheer" ? (
            <g className="pet-spark" fill="#ffd94a">
              <rect x="0" y="2" width="1" height="1" />
              <rect x="15" y="4" width="1" height="1" />
              <rect x="1" y="9" width="0.5" height="0.5" />
            </g>
          ) : null}
        </svg>
      </span>
    </span>
  );
}
