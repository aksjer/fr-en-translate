import { APICallError, RetryError } from "ai";
import { z } from "zod";
import { isInvalidAnswer } from "@/lib/model";
import { clientIp, rateLimit } from "@/lib/rate-limit";

// The free tier is rate limited too, so keep this conservative.
const RATE_LIMIT = 15;
const RATE_WINDOW_MS = 60_000;
// Room for a long sentence, its reference and the answer, or the history, the
// items to review and the items already known (up to 2,000 per mode).
const MAX_BODY_BYTES = 1_000_000;

type Guarded<T> =
  | { data: T; error?: never }
  | { data?: never; error: Response };

// Shared checks for the AI routes: per-IP rate limit, body size cap, JSON parsing,
// schema validation, then the Gemini API key.
export async function guardRequest<T>(
  request: Request,
  route: string,
  schema: z.ZodType<T>,
): Promise<Guarded<T>> {
  const { ok, retryAfter } = rateLimit(
    `${route}:${clientIp(request)}`,
    RATE_LIMIT,
    RATE_WINDOW_MS,
  );
  if (!ok) {
    return {
      error: Response.json(
        { error: "Too many requests. Wait a minute." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      ),
    };
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return {
      error: Response.json(
        { error: "The request is too long." },
        { status: 413 },
      ),
    };
  }

  let body: unknown = {};
  if (raw) {
    try {
      body = JSON.parse(raw);
    } catch {
      return {
        error: Response.json(
          { error: "The request is invalid." },
          { status: 400 },
        ),
      };
    }
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      error: Response.json(
        {
          error: "The request is invalid.",
          issues: z.treeifyError(parsed.error),
        },
        { status: 400 },
      ),
    };
  }

  if (!process.env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is missing");
    return {
      error: Response.json(
        { error: "GEMINI_API_KEY is missing on the server." },
        { status: 500 },
      ),
    };
  }

  return { data: parsed.data };
}

// Turns a failed model call into a response. Each failure gets its own
// message, and a 429 its own status, so the page can say what to do.
export function providerErrorResponse(error: unknown, fallback: string) {
  if (isInvalidAnswer(error)) {
    return Response.json(
      {
        error: "Gemini sent back an invalid answer. Try again.",
      },
      { status: 502 },
    );
  }
  const apiError = RetryError.isInstance(error) ? error.lastError : error;
  if (APICallError.isInstance(apiError)) {
    switch (apiError.statusCode) {
      case 400:
        return Response.json(
          {
            error:
              "Gemini rejected the request (error 400). Report it if it happens again.",
          },
          { status: 502 },
        );
      case 401:
      case 403:
        return Response.json(
          {
            error:
              "The Gemini API key was rejected. Check GEMINI_API_KEY on the server.",
          },
          { status: 502 },
        );
      case 404:
        return Response.json(
          {
            error:
              "This Gemini model is no longer available. It must be changed in the code.",
          },
          { status: 502 },
        );
      case 429:
        return Response.json(
          {
            error:
              "Gemini reached its requests-per-minute limit. Try again in a minute.",
          },
          { status: 429, headers: { "Retry-After": "60" } },
        );
      case 503:
        return Response.json(
          {
            error:
              "Gemini is very busy right now. Try again in a minute.",
          },
          { status: 503, headers: { "Retry-After": "60" } },
        );
    }
  }
  return Response.json({ error: fallback }, { status: 502 });
}
