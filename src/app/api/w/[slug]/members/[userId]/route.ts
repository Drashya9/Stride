import { getCtx } from "@/server/ctx";
import { readJson, route } from "@/server/http";
import { removeMember, updateMemberRole } from "@/server/services/workspaces";

export const PATCH = route<{ slug: string; userId: string }>(async (req, { slug, userId }) =>
  updateMemberRole(await getCtx(), slug, userId, await readJson(req)),
);

export const DELETE = route<{ slug: string; userId: string }>(async (_req, { slug, userId }) => {
  await removeMember(await getCtx(), slug, userId);
});
