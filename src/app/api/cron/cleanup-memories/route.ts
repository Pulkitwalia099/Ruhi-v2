import { deleteExpiredMemories } from "@/db/queries";

export async function GET(request: Request) {
  // Verify the request is from Vercel Cron
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const deletedCount = await deleteExpiredMemories();
    console.log(`[Cron] Cleaned up ${deletedCount} expired memories`);
    return Response.json({ success: true, deletedCount });
  } catch (error) {
    console.error("[Cron] Memory cleanup failed:", error);
    return Response.json(
      { success: false, error: "Cleanup failed" },
      { status: 500 },
    );
  }
}
