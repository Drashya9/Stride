import { z } from "zod";
import { getCtx } from "@/server/ctx";
import { route } from "@/server/http";
import { listEvents } from "@/server/services/board";

const Query = z.object({
  issueId: z.uuid().optional(),
  before: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().optional(),
});

export const GET = route<{ slug: string }>(async (req, { slug }) => {
  const opts = Query.parse(Object.fromEntries(new URL(req.url).searchParams));
  return listEvents(await getCtx(), slug, opts);
});
