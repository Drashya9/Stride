import { getCtx } from "@/server/ctx";
import { readJson, route } from "@/server/http";
import { createInvite, listInvites } from "@/server/services/workspaces";

export const GET = route<{ slug: string }>(async (_req, { slug }) => listInvites(await getCtx(), slug));

export const POST = route<{ slug: string }>(
  async (req, { slug }) => {
    const appUrl = process.env.APP_URL ?? new URL(req.url).origin;
    return createInvite(await getCtx(), slug, await readJson(req), appUrl);
  },
  { status: 201 },
);
