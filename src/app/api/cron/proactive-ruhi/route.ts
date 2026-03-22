import { runProactiveChecks } from "@/lib/proactive/checker";

export const maxDuration = 60; // Allow up to 60s for processing all users

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const sentCount = await runProactiveChecks();
    console.log(`[Cron] Proactive check complete: ${sentCount} messages sent`);
    return Response.json({ success: true, sentCount });
  } catch (error) {
    console.error("[Cron] Proactive check failed:", error);
    return Response.json(
      { success: false, error: "Proactive check failed" },
      { status: 500 },
    );
  }
}
