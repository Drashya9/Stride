import { getCtx } from "@/server/ctx";
import { readJson, route } from "@/server/http";
import { createComment, listComments } from "@/server/services/board";

export const GET = route<{ id: string }>(async (_req, { id }) => listComments(await getCtx(), id));

export const POST = route<{ id: string }>(
  async (req, { id }) => createComment(await getCtx(), id, await readJson(req)),
  { status: 201 },
);
