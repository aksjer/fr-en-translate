import { APICallError, RetryError } from "ai";
import { z } from "zod";
import {
  apiKeyName,
  isInvalidAnswer,
  PROVIDER_NAMES,
  safeModel,
} from "@/lib/model";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { providerOf, type Model } from "@/lib/model-list";

// The free tier is rate limited too, so keep this conservative.
const RATE_LIMIT = 15;
const RATE_WINDOW_MS = 60_000;
// Room for a long sentence, its reference and the answer, or the history and
// the items already known (up to 1,000 per mode).
const MAX_BODY_BYTES = 64_000;

type Guarded<T> =
  | { data: T; error?: never }
  | { data?: never; error: Response };

// Shared checks for the AI routes: per-IP rate limit, body size cap, JSON parsing,
// schema validation, then the API key of the chosen model's provider.
export async function guardRequest<T extends { model?: Model }>(
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
        { error: "Tu envoies trop de requêtes, attends une minute." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      ),
    };
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return {
      error: Response.json(
        { error: "La requête est trop longue." },
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
          { error: "La requête est invalide." },
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
          error: "La requête est invalide.",
          issues: z.treeifyError(parsed.error),
        },
        { status: 400 },
      ),
    };
  }

  const keyName = apiKeyName(parsed.data.model);
  if (!process.env[keyName]) {
    console.error(`${keyName} is missing`);
    return {
      error: Response.json(
        { error: `La clé ${keyName} manque sur le serveur. Choisis un autre modèle.` },
        { status: 500 },
      ),
    };
  }

  return { data: parsed.data };
}

// Turns a failed model call into a response. Each failure gets its own French
// message, and a 429 its own status, so the page can say what to do.
export function providerErrorResponse(
  error: unknown,
  fallback: string,
  model: Model | undefined,
) {
  const name = PROVIDER_NAMES[providerOf(safeModel(model))];
  const keyName = apiKeyName(model);
  if (isInvalidAnswer(error)) {
    return Response.json(
      {
        error: `${name} a renvoyé une réponse invalide. Réessaie, ou choisis un autre modèle.`,
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
              `${name} a refusé la demande (erreur 400). Signale-le si ça se répète.`,
          },
          { status: 502 },
        );
      case 401:
      case 403:
        return Response.json(
          {
            error:
              `La clé API ${name} est refusée. Vérifie ${keyName} sur le serveur.`,
          },
          { status: 502 },
        );
      case 404:
        return Response.json(
          {
            error:
              `Le modèle ${name} n'est plus disponible. Il faut changer le modèle dans le code.`,
          },
          { status: 502 },
        );
      case 429:
        return Response.json(
          {
            error:
              `${name} a atteint sa limite de requêtes par minute. Réessaie dans une minute.`,
          },
          { status: 429, headers: { "Retry-After": "60" } },
        );
      case 503:
        return Response.json(
          {
            error:
              `${name} est très sollicité en ce moment. Réessaie dans une minute.`,
          },
          { status: 503, headers: { "Retry-After": "60" } },
        );
    }
  }
  return Response.json({ error: fallback }, { status: 502 });
}
