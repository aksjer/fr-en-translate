import { MockLanguageModelV4 } from "ai/test";

// A fake model that always answers with this JSON, and keeps the prompts it got.
export function mockModel(answer: unknown) {
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: "text", text: JSON.stringify(answer) }],
      finishReason: { unified: "stop", raw: "stop" },
      usage: {
        inputTokens: {
          total: 10,
          noCache: 10,
          cacheRead: undefined,
          cacheWrite: undefined,
        },
        outputTokens: { total: 10, text: 10, reasoning: undefined },
      },
      warnings: [],
    }),
  });
}

// All the text the model received (system and user), to check the prompt.
export function promptText(model: MockLanguageModelV4) {
  return model.doGenerateCalls
    .flatMap((call) => call.prompt)
    .map((message) =>
      typeof message.content === "string"
        ? message.content
        : message.content
            .map((part) => ("text" in part ? part.text : ""))
            .join(""),
    )
    .join("\n");
}
