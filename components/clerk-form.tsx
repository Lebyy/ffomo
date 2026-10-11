"use client";

import { SignIn, SignUp } from "@clerk/nextjs";
import { useMounted } from "@/lib/store";

const formLook = {
  elements: {
    rootBox: "w-full",
    cardBox: "w-full !border-0 bg-transparent !shadow-none",
    card: "!w-full !border-0 bg-transparent !p-4 !shadow-none",
    header: "!hidden",
    footer: "!hidden",
  },
};

function AfterPaint({ children }: { children: React.ReactNode }) {
  if (!useMounted()) {
    return <p className="font-pixel text-muted-foreground">One second.</p>;
  }
  return children;
}

export function SignInForm() {
  return (
    <AfterPaint>
      <SignIn appearance={formLook} />
    </AfterPaint>
  );
}

export function SignUpForm() {
  return (
    <AfterPaint>
      <SignUp appearance={formLook} />
    </AfterPaint>
  );
}
