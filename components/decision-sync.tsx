"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect } from "react";
import { syncDecisions } from "@/lib/store";

export function DecisionSync() {
  const { userId } = useAuth();
  useEffect(() => {
    if (userId) void syncDecisions(userId);
  }, [userId]);
  return null;
}
