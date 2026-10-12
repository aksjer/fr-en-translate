import { APICallError, RetryError } from "ai";
import { z } from "zod";
import { clientIp, rateLimit } from "@/lib/rate-limit";

// The free tier is rate limited too, so keep this conservative.
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;
const MAX_BODY_BYTES = 4_000;

type Guarded<T> =
  | { data: T; error?: never }
  | { data?: never; error: Response };

// Shared checks for the AI routes: API key present, per-IP rate limit,
// body size cap, then JSON parsing and schema validation.
export async function guardRequest<T>(
  request: Request,
  route: string,
  schema: z.ZodType<T>,
): Promise<Guarded<T>> {
  if (!process.env.LLM_API_KEY) {
    console.error("LLM_API_KEY is missing");
    return {
      error: Response.json({ error: "Server misconfigured" }, { status: 500 }),
    };
  }

  const { ok, retryAfter } = rateLimit(
    `${route}:${clientIp(request)}`,
    RATE_LIMIT,
    RATE_WINDOW_MS,
  );
  if (!ok) {
    return {
      error: Response.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      ),
    };
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return {
      error: Response.json({ error: "Body too large" }, { status: 413 }),
    };
  }

  let body: unknown = {};
  if (raw) {
    try {
      body = JSON.parse(raw);
    } catch {
      return {
        error: Response.json({ error: "Invalid JSON" }, { status: 400 }),
      };
    }
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      error: Response.json(
        { error: "Invalid request", issues: z.treeifyError(parsed.error) },
        { status: 400 },
      ),
    };
  }

  return { data: parsed.data };
}

// Turns a failed model call into a response. A 429 from the provider gets its own
// French message and status, so the page can tell the user to wait.
export function providerErrorResponse(error: unknown, fallback: string) {
  const apiError = RetryError.isInstance(error) ? error.lastError : error;
  if (APICallError.isInstance(apiError) && apiError.statusCode === 429) {
    return Response.json(
      { error: "Trop de demandes, réessaie dans une minute." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }
  return Response.json({ error: fallback }, { status: 502 });
}
