# FR → EN

An app to learn American English from French. It gives a French word, verb
or sentence; you translate it, and a model corrects
your answer and explains each mistake.

The model chooses each item from the most common English (Oxford 5000, COCA)
at your level, using your history: items you got right never come back.
Your history, settings and progress stay in your browser.

## Run it

1. Copy `.env.example` to `.env.local` and add your free Gemini key: `GEMINI_API_KEY`.
2. `npm install`, then `npm run dev`, and open http://localhost:3000.

The prompts are in `lib/generate/` (one file per mode) and `lib/correct.ts`.
