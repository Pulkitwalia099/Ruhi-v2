import { getScanById } from "@/db/queries";
import { env } from "@/lib/env";
import { buildReportCardResponse, type ScanResults } from "@/lib/report/skin-report";

/**
 * Public API route — protected by CRON_SECRET to prevent
 * unauthorized access to clinical skin data.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ scanId: string }> },
) {
  const authHeader = request.headers.get("authorization");
  const expectedToken = env.CRON_SECRET;
  if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const { scanId } = await params;
    const scan = await getScanById({ id: scanId });

    if (!scan) {
      return new Response("Scan not found", { status: 404 });
    }

    const results = scan.results as unknown as ScanResults;
    if (!results?.zones || !results?.overall_score) {
      return new Response("Invalid scan data", { status: 422 });
    }

    return buildReportCardResponse(results, scan.createdAt);
  } catch (error) {
    console.error("[SkinReport] Error generating report card:", error);
    return new Response("Internal error", { status: 500 });
  }
}
