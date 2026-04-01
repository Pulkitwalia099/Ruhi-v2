import { redirect } from "next/navigation";

/**
 * PWA chat page — for now redirects to the existing chat interface.
 * Will be enhanced with rich inline components in a future sprint.
 */
export default async function PWAChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/chat/${id}`);
}
