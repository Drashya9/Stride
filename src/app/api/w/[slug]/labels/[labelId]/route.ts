import { getCtx } from "@/server/ctx";
import { route } from "@/server/http";
import { deleteLabel } from "@/server/services/board";

export const DELETE = route<{ slug: string; labelId: string }>(async (_req, { slug, labelId }) => {
  await deleteLabel(await getCtx(), slug, labelId);
});
