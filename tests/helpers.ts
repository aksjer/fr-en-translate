import { MockLanguageModelV4 } from "ai/test";

// A fake model that gives these answers in turn (the last one again after that),
// and keeps the prompts it got. A string is sent as is, anything else as JSON.
export function mockModel(...answers: unknown[]) {
  let calls = 0;
  return new MockLanguageModelV4({
    doGenerate: async () => {
      const answer = answers[Math.min(calls++, answers.length - 1)];
      const text = typeof answer === "string" ? answer : JSON.stringify(answer);
      return {
        content: [{ type: "text", text }],
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
      };
    },
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
