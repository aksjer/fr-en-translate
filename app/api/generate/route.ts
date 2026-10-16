import { guardRequest, providerErrorResponse } from "@/lib/api";
import { generateExercise, generateInputSchema } from "@/lib/generate";

export async function POST(request: Request) {
  const { data, error } = await guardRequest(
    request,
    "generate",
    generateInputSchema,
  );
  if (error) return error;

  try {
    return Response.json(await generateExercise(data));
  } catch (error) {
    console.error("Model generation failed", error);
    return providerErrorResponse(error, "The generation failed. Try again.");
  }
}
