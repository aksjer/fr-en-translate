import { guardRequest, providerErrorResponse } from "@/lib/api";
import { correctInputSchema, correctTranslation } from "@/lib/correct";

export async function POST(request: Request) {
  const { data, error } = await guardRequest(request, "correct", correctInputSchema);
  if (error) return error;
  try {
    return Response.json(await correctTranslation(data));
  } catch (error) {
    console.error("Model correction failed", error);
    return providerErrorResponse(error, "The correction failed. Try again.");
  }
}
