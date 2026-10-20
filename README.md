# FR → EN

An app to learn American English from French. It gives a French word, verb
or sentence; you translate it, and a model corrects
your answer and explains each mistake.

The model chooses each item from the most common everyday English (Oxford 3000,
COCA), using your history: items you got right never come back, and missed ones
come back for review. Your history, settings and progress stay in your browser;
Settings > Backup exports and imports them as a JSON file.

## Run it

1. Copy `.env.example` to `.env.local` and add your free Gemini key: `GEMINI_API_KEY`.
2. `npm install`, then `npm run dev`, and open http://localhost:3000.

The prompts are in `lib/generate/` (one file per mode) and `lib/correct.ts`.
