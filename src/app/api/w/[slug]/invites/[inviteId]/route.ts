import { getCtx } from "@/server/ctx";
import { route } from "@/server/http";
import { revokeInvite } from "@/server/services/workspaces";

export const DELETE = route<{ slug: string; inviteId: string }>(async (_req, { slug, inviteId }) => {
  await revokeInvite(await getCtx(), slug, inviteId);
});
