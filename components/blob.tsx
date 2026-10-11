export function SpeakBlob({
  mood,
}: {
  mood: "idle" | "listen" | "talk";
}) {
  return (
    <span className="speak-blob" data-mood={mood} aria-hidden>
      <span className="speak-core" />
      <span className="speak-ring" />
      <span className="speak-ring is-late" />
    </span>
  );
}
