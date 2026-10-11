import { auth } from "@clerk/nextjs/server";
import { Suspense, ViewTransition } from "react";
import { Shell } from "@/components/shell";
import { ClientSession } from "./client";

export default function Page({ params }: PageProps<"/d/[id]">) {
  return (
    <Suspense
      fallback={
        <ViewTransition exit="fade-out" default="none">
          <Shell>
            <p className="enter-fade text-muted-foreground">Looking for it.</p>
          </Shell>
        </ViewTransition>
      }
    >
      <ViewTransition enter="rise-in" exit="fade-out" default="none">
        <Loaded params={params} />
      </ViewTransition>
    </Suspense>
  );
}

async function Loaded({ params }: { params: PageProps<"/d/[id]">["params"] }) {
  await auth.protect();
  const { id } = await params;
  return <ClientSession id={id} />;
}
