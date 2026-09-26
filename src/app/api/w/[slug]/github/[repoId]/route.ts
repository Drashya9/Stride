import { getCtx } from "@/server/ctx";
import { route } from "@/server/http";
import { unlinkRepo } from "@/server/services/github";

export const DELETE = route<{ slug: string; repoId: string }>(async (_req, { slug, repoId }) => {
  await unlinkRepo(await getCtx(), slug, repoId);
});
