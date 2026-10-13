import { APICallError, RetryError } from "ai";
import { z } from "zod";
import { clientIp, rateLimit } from "@/lib/rate-limit";

// The free tier is rate limited too, so keep this conservative.
const RATE_LIMIT = 15;
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
        { error: "Tu envoies trop de requêtes, attends une minute." },
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
// Each provider failure gets its own French message, so the page can say what to do.
export function providerErrorResponse(error: unknown, fallback: string) {
  const apiError = RetryError.isInstance(error) ? error.lastError : error;
  if (APICallError.isInstance(apiError)) {
    switch (apiError.statusCode) {
      case 400:
        return Response.json(
          {
            error:
              "Gemini a refusé la demande (erreur 400). Signale-le si ça se répète.",
          },
          { status: 502 },
        );
      case 401:
      case 403:
        return Response.json(
          {
            error:
              "La clé API Gemini est refusée. Vérifie LLM_API_KEY sur le serveur.",
          },
          { status: 502 },
        );
      case 404:
        return Response.json(
          {
            error:
              "Le modèle Gemini n'est plus disponible. Il faut changer le modèle dans le code.",
          },
          { status: 502 },
        );
      case 429:
        return Response.json(
          {
            error:
              "Gemini a atteint sa limite de requêtes par minute. Réessaie dans une minute.",
          },
          { status: 429, headers: { "Retry-After": "60" } },
        );
      case 503:
        return Response.json(
          {
            error:
              "Gemini est très sollicité en ce moment. Réessaie dans une minute.",
          },
          { status: 503, headers: { "Retry-After": "60" } },
        );
    }
  }
  return Response.json({ error: fallback }, { status: 502 });
}
