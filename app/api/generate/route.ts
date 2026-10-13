import { generateText } from "ai";
import { z } from "zod";
import { guardRequest, providerErrorResponse } from "@/lib/api";
import { providerOptions, withFallback } from "@/lib/model";
import {
  pickCombination,
  settingsSchema,
  type Combination,
} from "@/lib/settings";

// Leaves room for the fallback attempt (see lib/model.ts).
export const maxDuration = 30;

const requestSchema = settingsSchema.extend({
  // Recent exercises, so the model doesn't keep giving the same words.
  avoid: z.array(z.string().max(80)).max(20).optional(),
  // Mistakes due for review, worked into the sentence without being named.
  review: z
    .array(
      z.object({
        correction: z.string().max(800),
        tag: z.string().max(40).optional(),
      }),
    )
    .max(2)
    .optional(),
});

function instructions({ mode, level, tense, verbType, theme }: Combination) {
  switch (mode) {
    case "mot":
      return (
        `Donne un seul nom, adjectif ou adverbe français de niveau CECRL ${level}, ` +
        `lié au thème « ${theme} ». Ajoute l'article pour un nom (le, la, l', un, une). ` +
        "Choisis un mot dont la traduction en anglais américain est claire."
      );
    case "verbe":
      return (
        `Donne un seul verbe français à l'infinitif, de niveau CECRL ${level}, ` +
        `dont la traduction en anglais américain est un verbe ${verbType} ` +
        "(au sens des verbes irréguliers anglais : go/went/gone est irrégulier, " +
        "work/worked/worked est régulier). Pas de verbe qui se traduit par un phrasal verb."
      );
    case "phrasal verb":
      return (
        `Donne un verbe ou une courte expression en français, de niveau CECRL ${level}, ` +
        `lié au thème « ${theme} », qui se traduit naturellement en anglais américain ` +
        "par un phrasal verb (ex. : « abandonner (une habitude) » → give up). " +
        "Ajoute entre parenthèses un court contexte si le sens est ambigu."
      );
    case "phrase":
      return (
        `Écris une phrase originale de niveau CECRL ${level}, ` +
        `conjuguée au ${tense}, sur le thème « ${theme} ». ` +
        "Adapte la longueur et le vocabulaire au niveau."
      );
    case "paragraphe":
      return (
        `Écris un court paragraphe de trois phrases liées entre elles, de niveau CECRL ${level}, ` +
        `sur le thème « ${theme} ». Utilise des connecteurs logiques (d'abord, pourtant, donc…). ` +
        "Adapte la longueur et le vocabulaire au niveau."
      );
  }
}

// Some models answer with the JSON again inside the field, as {"text": "..."}.
// Take the sentence out of it when that happens.
function unwrapText(raw: string) {
  // Strips a Markdown code fence, then a {"text": ...} wrapper, quoted or not.
  const unfenced = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const wrapped = unfenced.match(/^\{\s*"?text"?\s*:\s*"?([\s\S]*?)"?\s*\}$/);
  return (wrapped ? wrapped[1] : unfenced).trim();
}

export async function POST(request: Request) {
  const { data, error } = await guardRequest(
    request,
    "generate",
    requestSchema,
  );
  if (error) return error;

  const combination = pickCombination(data);
  const avoid = data.avoid?.length
    ? `\nÉvite ces éléments déjà donnés : ${data.avoid.join(" ; ")}.`
    : "";
  const review = data.review?.length
    ? "\nIntègre naturellement dans la phrase, sans le signaler, la difficulté suivante : " +
      data.review
        .map((item) => `${item.tag ?? "point"} (ex. : « ${item.correction} »)`)
        .join(" ; ") +
      "."
    : "";

  try {
    const { result: output, model: usedModel } = await withFallback(
      (model, abortSignal) =>
        generateText({
          model,
          abortSignal,
          providerOptions,
          temperature: 1,
          maxRetries: 0,
          maxOutputTokens: 600,
          system:
            "Tu es un professeur de français. Tu donnes un élément en français, " +
            "naturel et correct, qu'un apprenant devra traduire en anglais américain. " +
            "Pas de traduction, pas d'explication, pas de guillemets. " +
            "Réponds uniquement avec l'élément, en texte brut, sans JSON.",
          prompt: instructions(combination) + avoid + review,
        }),
    );

    return Response.json({
      text: unwrapText(output.text),
      ...combination,
      model: usedModel,
    });
  } catch (error) {
    console.error("Gemini generation failed", error);
    return providerErrorResponse(error, "Generation failed");
  }
}
