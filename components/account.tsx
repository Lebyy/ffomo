"use client";

import { SignInButton, SignUpButton, Show, UserButton } from "@clerk/nextjs";
import { useMounted } from "@/lib/store";

const pill =
  "glass inline-flex h-8 items-center rounded-xl px-3 font-pixel text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95";

export function Account() {
  if (!useMounted()) return <span aria-hidden className="block size-8 rounded-xl bg-muted" />;
  return (
    <>
      <Show when="signed-out">
        <div className="flex items-center gap-1.5">
          <SignInButton>
            <button type="button" className={pill}>
              In
            </button>
          </SignInButton>
          <SignUpButton>
            <button type="button" className={pill}>
              Join
            </button>
          </SignUpButton>
        </div>
      </Show>
      <Show when="signed-in">
        <UserButton
          appearance={{
            elements: {
              avatarBox: "size-8 overflow-hidden rounded-xl",
            },
          }}
        />
      </Show>
    </>
  );
}
