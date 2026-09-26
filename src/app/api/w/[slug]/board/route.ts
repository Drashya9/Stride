import { getCtx } from "@/server/ctx";
import { route } from "@/server/http";
import { getBoard } from "@/server/services/board";

export const GET = route<{ slug: string }>(async (_req, { slug }) => getBoard(await getCtx(), slug));
