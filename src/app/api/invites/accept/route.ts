import { getCtx } from "@/server/ctx";
import { readJson, route } from "@/server/http";
import { acceptInvite } from "@/server/services/workspaces";

export const POST = route(async (req) => acceptInvite(await getCtx(), await readJson(req)));
