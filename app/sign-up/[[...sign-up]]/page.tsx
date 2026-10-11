import { SignUpForm } from "@/components/clerk-form";
import { Shell } from "@/components/shell";

export default function SignUpPage() {
  return (
    <Shell>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-2">
        <div className="flex shrink-0 flex-col gap-1.5">
          <p className="font-pixel text-sm text-primary">F the FOMO.</p>
          <h1 className="font-pixel text-[2.1rem] leading-[1.05] font-semibold text-balance">
            Join
          </h1>
          <p className="text-sm text-pretty text-muted-foreground">
            Make an account, then see both paths.
          </p>
        </div>
        <div className="glass mx-auto w-full overflow-hidden rounded-3xl">
          <SignUpForm />
        </div>
      </div>
    </Shell>
  );
}
