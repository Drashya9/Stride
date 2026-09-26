import { ZodError } from "zod";
import { AppError, BadRequest } from "./errors";

type RouteContext<P> = { params: Promise<P> };

/**
 * Wraps a route handler: resolves params, serialises the return value as JSON
 * and maps thrown errors to a consistent `{ error: { code, message } }` body.
 */
export function route<P = Record<string, never>>(
  fn: (req: Request, params: P) => Promise<unknown>,
  opts: { status?: number } = {},
) {
  return async (req: Request, ctx: RouteContext<P>): Promise<Response> => {
    try {
      const params = ctx?.params ? await ctx.params : ({} as P);
      const result = await fn(req, params);
      if (result instanceof Response) return result;
      if (result === undefined) return new Response(null, { status: 204 });
      return Response.json(result, { status: opts.status ?? 200 });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export function errorResponse(err: unknown): Response {
  if (err instanceof ZodError) {
    return Response.json(
      { error: { code: "validation_error", message: err.issues[0]?.message ?? "Invalid input", details: err.issues } },
      { status: 422 },
    );
  }
  if (err instanceof AppError) {
    return Response.json({ error: { code: err.code, message: err.message, details: err.details } }, { status: err.status });
  }
  // Postgres "invalid input syntax" (e.g. a malformed uuid in the URL) is a client error.
  // Drizzle wraps driver errors, so check the cause too.
  const pgCode = (e: unknown) => (typeof e === "object" && e && "code" in e ? e.code : undefined);
  if (pgCode(err) === "22P02" || pgCode((err as { cause?: unknown })?.cause) === "22P02") {
    return Response.json({ error: { code: "not_found", message: "Not found" } }, { status: 404 });
  }
  console.error("[api] unhandled error", err);
  return Response.json({ error: { code: "internal", message: "Something went wrong" } }, { status: 500 });
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new BadRequest("Request body must be valid JSON");
  }
}
