import { auth } from "@clerk/nextjs/server";

export async function needSignIn() {
  const { isAuthenticated } = await auth();
  if (isAuthenticated) return null;
  return Response.json({ error: "Sign in first." }, { status: 401 });
}
