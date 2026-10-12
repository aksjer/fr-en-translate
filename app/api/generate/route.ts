import { mistral } from "@ai-sdk/mistral";
import { generateText, Output } from "ai";
import { z } from "zod";
import { guardRequest } from "@/lib/api";
import { pickCombination, settingsSchema } from "@/lib/settings";

export async function POST(request: Request) {
  const { data, error } = await guardRequest(request, "generate", settingsSchema);
  if (error) return error;

  const combination = pickCombination(data);

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
