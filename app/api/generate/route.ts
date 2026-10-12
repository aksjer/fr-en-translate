import { mistral } from "@ai-sdk/mistral";
import { generateText, Output } from "ai";
import { z } from "zod";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { pickCombination, settingsSchema } from "@/lib/settings";

// Mistral's free tier is rate limited too, so keep this conservative.
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;
const MAX_BODY_BYTES = 2_000;

export async function POST(request: Request) {
  if (!process.env.MISTRAL_API_KEY) {
    console.error("MISTRAL_API_KEY is missing");
    return Response.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const { ok, retryAfter } = rateLimit(
    `generate:${clientIp(request)}`,
    RATE_LIMIT,
    RATE_WINDOW_MS,
  );
  if (!ok) {
    return Response.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return Response.json({ error: "Body too large" }, { status: 413 });
  }

  let body: unknown = {};
  if (raw) {
    try {
      body = JSON.parse(raw);
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }
  }

  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid settings", issues: z.treeifyError(parsed.error) },
      { status: 400 },
    );
  }

  const combination = pickCombination(parsed.data);

  try {
    const { output } = await generateText({
      model: mistral("mistral-small-latest"),
      temperature: 1,
      maxOutputTokens: 200,
      output: Output.object({
        schema: z.object({ sentence: z.string().min(1).max(400) }),
      }),
      system:
        "Tu es un professeur de français. Tu écris une seule phrase en français, " +
        "naturelle et correcte, qu'un apprenant devra traduire en anglais américain. " +
        "Pas de traduction, pas d'explication, pas de guillemets.",
      prompt:
        `Écris une phrase originale de niveau CECRL ${combination.level}, ` +
        `conjuguée au ${combination.tense}, sur le thème « ${combination.theme} ». ` +
        "Adapte la longueur et le vocabulaire au niveau.",
    });

    return Response.json({ sentence: output.sentence.trim(), ...combination });
  } catch (error) {
    console.error("Mistral generation failed", error);
    return Response.json(
      { error: "Sentence generation failed" },
      { status: 502 },
    );
  }
}
