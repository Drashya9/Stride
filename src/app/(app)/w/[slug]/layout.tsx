import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { notFound } from "next/navigation";
import { boardKey } from "@/lib/query-keys";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getCtx } from "@/server/ctx";
import { NotFound } from "@/server/errors";
import { getBoard } from "@/server/services/board";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ctx = await getCtx();

  // Render the first paint with data (no spinner): seed the client cache on the server.
  const queryClient = new QueryClient();
  try {
    const board = await getBoard(ctx, slug);
    queryClient.setQueryData(boardKey(slug), board);
  } catch (err) {
    if (err instanceof NotFound) notFound();
    throw err;
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <WorkspaceShell slug={slug}>{children}</WorkspaceShell>
    </HydrationBoundary>
  );
}
