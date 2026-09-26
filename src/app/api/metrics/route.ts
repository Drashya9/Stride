import { getCtx } from "@/server/ctx";
import { readJson, route } from "@/server/http";
import { recordMetrics } from "@/server/services/metrics";

export const POST = route(async (req) => {
  await recordMetrics(await getCtx(), await readJson(req));
});
