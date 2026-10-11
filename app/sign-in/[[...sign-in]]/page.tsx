import { Bubble } from "@/components/chat";
import { SignInForm } from "@/components/clerk-form";
import { Shell } from "@/components/shell";

export default function SignInPage() {
  return (
    <Shell>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-2">
        <Bubble from="ffomo" face>
          <p className="font-pixel text-lg leading-tight">Come in</p>
          <p className="mt-1 text-muted-foreground">
            Sign in to start. Your decisions save to your account.
          </p>
        </Bubble>
        <div className="glass mx-auto w-full overflow-hidden rounded-3xl">
          <SignInForm />
        </div>
      </div>
    </Shell>
  );
}
