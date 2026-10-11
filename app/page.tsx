import { auth } from "@clerk/nextjs/server";
import { Suspense } from "react";
import { Shell } from "@/components/shell";
import Start from "./start";

async function Gate() {
  await auth.protect();
  return <Start />;
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <Shell>
          <p className="font-pixel text-muted-foreground">One second.</p>
        </Shell>
      }
    >
      <Gate />
    </Suspense>
  );
}
