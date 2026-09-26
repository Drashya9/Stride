import { getCtx } from "@/server/ctx";
import { readJson, route } from "@/server/http";
import { createWorkspace, listWorkspaces } from "@/server/services/workspaces";

export const GET = route(async () => listWorkspaces(await getCtx()));

export const POST = route(async (req) => createWorkspace(await getCtx(), await readJson(req)), { status: 201 });
