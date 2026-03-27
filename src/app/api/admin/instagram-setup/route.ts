import { NextRequest, NextResponse } from "next/server";

const GRAPH_API = "https://graph.instagram.com/v22.0";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-setup-secret");
  if (secret !== process.env.INSTAGRAM_SETUP_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN!;
  const pageId = process.env.INSTAGRAM_PAGE_ID!;

  const res = await fetch(`${GRAPH_API}/${pageId}/messenger_profile`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      ice_breakers: [{
        call_to_actions: [
          { question: "✨ Skin scan karo!", payload: "ICE_skin_analysis" },
          { question: "🧴 Skin issue help chahiye", payload: "ICE_skin_issue" },
          { question: "💬 Bas baat karni hai", payload: "ICE_just_chat" },
          { question: "Noor kaun hai?", payload: "ICE_about" },
        ],
        locale: "default",
      }],
    }),
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.ok ? 200 : 500 });
}
