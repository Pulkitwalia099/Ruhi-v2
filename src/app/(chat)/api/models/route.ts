import { getCapabilities } from "@/lib/ai/models";

// ---------------------------------
// src/app/(chat)/api/models/route.ts
//
// export async function GET()    L9
// ---------------------------------

export async function GET() {
  const capabilities = getCapabilities();

  return Response.json(capabilities, {
    headers: {
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
