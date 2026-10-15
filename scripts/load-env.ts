// Loads .env.local before the app modules read their keys, like Next does.
// Imported first by the scripts, so it runs before the other imports.
try {
  process.loadEnvFile(".env.local");
} catch {
  // No file, or an older Node: the keys must come from the environment.
}
