import { Bubble } from "@/components/chat";
import { SignUpForm } from "@/components/clerk-form";
import { Shell } from "@/components/shell";

export default function SignUpPage() {
  return (
    <Shell>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-2">
        <Bubble from="ffomo" face>
          <p className="font-pixel text-lg leading-tight">Join</p>
          <p className="mt-1 text-muted-foreground">
            Make an account, then see both paths.
          </p>
        </Bubble>
        <div className="glass mx-auto w-full overflow-hidden rounded-3xl">
          <SignUpForm />
        </div>
      </div>
    </Shell>
  );
}
