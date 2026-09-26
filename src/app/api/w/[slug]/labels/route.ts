import { getCtx } from "@/server/ctx";
import { readJson, route } from "@/server/http";
import { createLabel } from "@/server/services/board";

export const POST = route<{ slug: string }>(
  async (req, { slug }) => createLabel(await getCtx(), slug, await readJson(req)),
  { status: 201 },
);
