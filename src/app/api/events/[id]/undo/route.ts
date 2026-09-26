import { z } from "zod";
import { getCtx } from "@/server/ctx";
import { route } from "@/server/http";
import { undoEvent } from "@/server/services/issues";

export const POST = route<{ id: string }>(async (_req, { id }) =>
  undoEvent(await getCtx(), z.coerce.number().int().positive().parse(id)),
);
