import { getSessionCookie } from "better-auth/cookies";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { env } from "@/lib/env";

// ----------------------------------
// src/app/(auth)/api/auth/guest/route.ts
//
// export async function GET()    L12
// ----------------------------------

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawRedirect = searchParams.get("redirectUrl") || "/";
  const redirectUrl =
    rawRedirect.startsWith("/") && !rawRedirect.startsWith("//")
      ? rawRedirect
      : "/";

  const sessionCookie = getSessionCookie(request);

  if (sessionCookie) {
    const base = env.NEXT_PUBLIC_BASE_PATH;
    return NextResponse.redirect(new URL(`${base}/`, request.url));
  }

  await auth.api.signInAnonymous();

  const base = env.NEXT_PUBLIC_BASE_PATH;
  return NextResponse.redirect(new URL(`${base}${redirectUrl}`, request.url));
}
