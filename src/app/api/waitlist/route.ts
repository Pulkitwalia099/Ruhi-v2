import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { email, companion } = await request.json();

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  // Placeholder: log to console. Wire to DB in a follow-up.
  console.log(`[waitlist] ${email} wants to know when ${companion} launches`);

  return NextResponse.json({ ok: true });
}
