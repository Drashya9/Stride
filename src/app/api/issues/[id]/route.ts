import { getCtx } from "@/server/ctx";
import { readJson, route } from "@/server/http";
import { deleteIssue, getIssue, updateIssue } from "@/server/services/issues";

export const GET = route<{ id: string }>(async (_req, { id }) => getIssue(await getCtx(), id));

export const PATCH = route<{ id: string }>(async (req, { id }) => updateIssue(await getCtx(), id, await readJson(req)));

export const DELETE = route<{ id: string }>(async (_req, { id }) => deleteIssue(await getCtx(), id));
