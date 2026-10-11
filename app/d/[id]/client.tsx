"use client";

import dynamic from "next/dynamic";
import { Shell } from "@/components/shell";
import { readDecision, useMounted, useSynced } from "@/lib/store";

const loading = (
  <Shell>
    <p className="text-muted-foreground">Looking for it.</p>
  </Shell>
);

const Session = dynamic(() => import("./session").then((mod) => mod.Session), {
  ssr: false,
  loading: () => loading,
});

export function ClientSession({ id }: { id: string }) {
  const mounted = useMounted();
  const synced = useSynced();
  if (!mounted || (!synced && !readDecision(id))) return loading;
  return <Session key={id} id={id} />;
}
