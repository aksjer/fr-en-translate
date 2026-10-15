import assert from "node:assert/strict";
import test from "node:test";
import { zodSchema } from "ai";
import type { z } from "zod";
import { correctionSchema, wordCorrectionSchema } from "@/lib/correct";
import { exerciseSchema } from "@/lib/generate";

type JsonSchema = {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  anyOf?: JsonSchema[];
};

// Groq's strict JSON mode rejects an object whose properties aren't all required.
function assertAllRequired(schema: JsonSchema, path: string) {
  if (schema.properties) {
    const keys = Object.keys(schema.properties).sort();
    assert.deepEqual([...(schema.required ?? [])].sort(), keys, `${path}: every property must be required`);
    for (const [key, value] of Object.entries(schema.properties)) {
      assertAllRequired(value, `${path}.${key}`);
    }
  }
  if (schema.items) assertAllRequired(schema.items, `${path}[]`);
  schema.anyOf?.forEach((option, index) => assertAllRequired(option, `${path}|${index}`));
}

const schemas: [string, z.ZodType][] = [
  ["exercise", exerciseSchema],
  ["correction", correctionSchema],
  ["word correction", wordCorrectionSchema],
];

for (const [name, schema] of schemas) {
  test(`${name} schema works with Groq's strict JSON mode`, async () => {
    const json = (await zodSchema(schema).jsonSchema) as JsonSchema;
    assertAllRequired(json, name);
  });
}
