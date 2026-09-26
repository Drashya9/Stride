import { getCtx } from "@/server/ctx";
import { readJson, route } from "@/server/http";
import { moveIssue } from "@/server/services/issues";

export const POST = route<{ id: string }>(async (req, { id }) => moveIssue(await getCtx(), id, await readJson(req)));
