import { getCtx } from "@/server/ctx";
import { route } from "@/server/http";
import { searchIssues } from "@/server/services/board";

export const GET = route<{ slug: string }>(async (req, { slug }) => {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  return searchIssues(await getCtx(), slug, q);
});
