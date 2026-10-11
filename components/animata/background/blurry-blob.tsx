// Animata blurry blob (MIT): https://animata.design/docs/background/blurry-blob
import { cn } from "@/lib/utils";

interface BlobProps extends React.HTMLAttributes<HTMLDivElement> {
  firstBlobColor: string;
  secondBlobColor: string;
}

export default function BlurryBlob({ className, firstBlobColor, secondBlobColor }: BlobProps) {
  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <div className={cn("absolute -top-40 -right-24 h-80 w-80 rounded-full opacity-40 blur-3xl", firstBlobColor)} />
      <div className={cn("absolute -bottom-32 -left-28 h-72 w-72 rounded-full opacity-30 blur-3xl", secondBlobColor)} />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--background)_58%,transparent_88%)]" />
    </div>
  );
}
