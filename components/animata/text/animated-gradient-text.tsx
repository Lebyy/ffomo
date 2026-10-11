// Animata gradient text (MIT): https://animata.design/docs/text/animated-gradient-text
import { cn } from "@/lib/utils";

export default function AnimatedGradientText({
  className,
  children,
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "animate-bg-position bg-linear-to-r from-primary from-30% via-white via-50% to-(--blob-a) to-80% bg-size-[200%_auto] bg-clip-text text-transparent",
        className,
      )}
    >
      {children}
    </span>
  );
}
