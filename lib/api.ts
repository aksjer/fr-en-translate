import { z } from "zod";
import { clientIp, rateLimit } from "@/lib/rate-limit";

// Mistral's free tier is rate limited too, so keep this conservative.
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;
const MAX_BODY_BYTES = 2_000;

type Guarded<T> = { data: T; error?: never } | { data?: never; error: Response };

// Shared checks for the AI routes: API key present, per-IP rate limit,
// body size cap, then JSON parsing and schema validation.
export async function guardRequest<T>(
  request: Request,
  route: string,
  schema: z.ZodType<T>,
): Promise<Guarded<T>> {
  if (!process.env.MISTRAL_API_KEY) {
    console.error("MISTRAL_API_KEY is missing");
    return { error: Response.json({ error: "Server misconfigured" }, { status: 500 }) };
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
    return { error: Response.json({ error: "Body too large" }, { status: 413 }) };
  }

  let body: unknown = {};
  if (raw) {
    try {
      body = JSON.parse(raw);
    } catch {
      return { error: Response.json({ error: "Invalid JSON" }, { status: 400 }) };
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
