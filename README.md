# FR → EN

An app to learn American English from French. It gives a French word, verb
or sentence; you translate it, and a model corrects
your answer with a short explanation.

The model writes items from your settings and avoids the last ones you saw.
Your history, settings and progress stay in your browser;
Settings > Backup exports and imports them as a JSON file.

## Run it

1. Copy `.env.example` to `.env.local` and add your free Gemini key: `GEMINI_API_KEY`.
2. `npm install`, then `npm run dev`, and open http://localhost:3000.

The prompts are in `lib/generate.ts` and `lib/correct.ts`.
