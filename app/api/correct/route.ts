import { guardRequest, providerErrorResponse } from "@/lib/api";
import { correctInputSchema, correctTranslation } from "@/lib/correct";

// The answer is a stream of JSON lines (NDJSON): { remarks } while the model
// writes, then { result } or { error }. A refused request stays a plain JSON error.
export async function POST(request: Request) {
  const { data, error } = await guardRequest(request, "correct", correctInputSchema);
  if (error) return error;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (line: object) =>
        controller.enqueue(encoder.encode(JSON.stringify(line) + "\n"));
      try {
        const result = await correctTranslation(data, (remarks) => send({ remarks }));
        send({ result });
      } catch (error) {
        console.error("Model correction failed", error);
        const response = providerErrorResponse(error, "The correction failed. Try again.");
        send(await response.json());
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
  });
}
