import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { createLinkCode, getLinkStatus } from "@/db/queries";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const status = await getLinkStatus({ userId: session.user.id });
  return NextResponse.json(status);
}

export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = await getLinkStatus({ userId: session.user.id });
  if (status.linked) {
    return NextResponse.json(
      { error: "Account is already linked to Telegram" },
      { status: 400 },
    );
  }

  const linkCodeRecord = await createLinkCode({ userId: session.user.id });
  return NextResponse.json({
    code: linkCodeRecord.code,
    expiresAt: linkCodeRecord.expiresAt.toISOString(),
  });
}
