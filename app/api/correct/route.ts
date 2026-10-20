import { guardRequest, providerErrorResponse } from "@/lib/api";
import { correctInputSchema, correctTranslation } from "@/lib/correct";

// The answer is a stream of JSON lines (NDJSON): { remarks } while the model
// writes, then { result } or { error }. A refused request stays a plain JSON error.
export async function POST(request: Request) {
  const { data, error } = await guardRequest(request, "correct", correctInputSchema);
  if (error) return error;

  const encoder = new TextEncoder();
  // The page may leave mid-stream: the stream is closed then, and nothing more
  // is sent.
  let open = true;
  const stream = new ReadableStream({
    async start(controller) {
      const send = (line: object) => {
        if (open) controller.enqueue(encoder.encode(JSON.stringify(line) + "\n"));
      };
      try {
        const result = await correctTranslation(
          data,
          (remarks) => send({ remarks }),
          request.signal,
        );
        send({ result });
      } catch (error) {
        if (!open) return;
        console.error("Model correction failed", error);
        const response = providerErrorResponse(error, "The correction failed. Try again.");
        send(await response.json());
      } finally {
        if (open) controller.close();
      }
    },
    cancel() {
      open = false;
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
  });
}
