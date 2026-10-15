import assert from "node:assert/strict";
import test from "node:test";
import { NoObjectGeneratedError } from "ai";
import { providerErrorResponse } from "@/lib/api";
import { InvalidAnswerError, temperatureFor } from "@/lib/model";

test("Gemini keeps its default temperature, as Google recommends", () => {
  assert.equal(temperatureFor("gemini-3.5-flash-lite", "correct"), 1);
  assert.equal(temperatureFor(undefined, "correct"), 1);
  assert.equal(temperatureFor("openai/gpt-oss-120b", "correct"), 0.2);
  assert.equal(temperatureFor("qwen/qwen3.8-27b", "correct"), 0.6);
  assert.equal(temperatureFor("openai/gpt-oss-120b", "generate"), 1);
});

test("an unusable answer gets a French message", async () => {
  for (const error of [
    new InvalidAnswerError("Empty correction"),
    new NoObjectGeneratedError({
      message: "No object generated: response did not match schema.",
      text: "{}",
      response: { id: "1", timestamp: new Date(), modelId: "test" },
      usage: {
        inputTokens: undefined,
        inputTokenDetails: {
          noCacheTokens: undefined,
          cacheReadTokens: undefined,
          cacheWriteTokens: undefined,
        },
        outputTokens: undefined,
        outputTokenDetails: { textTokens: undefined, reasoningTokens: undefined },
        totalTokens: undefined,
      },
      finishReason: "stop",
    }),
  ]) {
    const response = providerErrorResponse(error, "La correction a échoué.", undefined);
    assert.equal(response.status, 502);
    const body = await response.json();
    assert.match(body.error, /Gemini a renvoyé une réponse invalide/);
  }
});
