import { getCtx } from "@/server/ctx";
import { readJson, route } from "@/server/http";
import { linkRepo, listRepos } from "@/server/services/github";

export const GET = route<{ slug: string }>(async (_req, { slug }) => listRepos(await getCtx(), slug));

export const POST = route<{ slug: string }>(
  async (req, { slug }) => linkRepo(await getCtx(), slug, await readJson(req)),
  { status: 201 },
);
