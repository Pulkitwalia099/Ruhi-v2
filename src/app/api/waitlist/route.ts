import { NextResponse } from "next/server";
import { addToWaitlist } from "@/db/queries";

export async function POST(request: Request) {
  const { email, companion } = await request.json();

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  try {
    await addToWaitlist(email, companion);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[waitlist] Failed to save:", error);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
