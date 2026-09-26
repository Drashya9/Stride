import { getCtx } from "@/server/ctx";
import { readJson, route } from "@/server/http";
import { createIssue } from "@/server/services/issues";

export const POST = route<{ slug: string }>(
  async (req, { slug }) => createIssue(await getCtx(), slug, await readJson(req)),
  { status: 201 },
);
