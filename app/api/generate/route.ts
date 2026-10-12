import { generateText, Output } from "ai";
import { z } from "zod";
import { guardRequest, providerErrorResponse } from "@/lib/api";
import { modelFor } from "@/lib/model";
import {
  pickCombination,
  settingsSchema,
  type Combination,
} from "@/lib/settings";

const requestSchema = settingsSchema.extend({
  // Recent exercises, so the model doesn't keep giving the same words.
  avoid: z.array(z.string().max(80)).max(20).optional(),
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
  }
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

  try {
    const { output } = await generateText({
      model: modelFor(data.model),
      temperature: 1,
      maxRetries: 1,
      maxOutputTokens: 600,
      // Gemini 2.5 Flash thinks by default, and thinking tokens counted against the limit.
      providerOptions: { google: { thinkingConfig: { thinkingBudget: 0 } } },
      output: Output.object({
        schema: z.object({ text: z.string().min(1).max(400) }),
      }),
      system:
        "Tu es un professeur de français. Tu donnes un élément en français, " +
        "naturel et correct, qu'un apprenant devra traduire en anglais américain. " +
        "Pas de traduction, pas d'explication, pas de guillemets.",
      prompt: instructions(combination) + avoid,
    });

    return Response.json({ text: output.text.trim(), ...combination });
  } catch (error) {
    console.error("Gemini generation failed", error);
    return providerErrorResponse(error, "Generation failed");
  }
}
