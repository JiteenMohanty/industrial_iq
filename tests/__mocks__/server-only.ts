// Vitest runs under Vite/Rollup, not Next.js's webpack pipeline, so the bundler-condition trick
// that makes the real `server-only` package a no-op for server code and a build error for client
// code never applies — it always throws. Aliased here to a no-op so tests can import
// server-only-guarded modules directly. The guard itself stays real and load-bearing for
// `npm run build`, which is the actual constitutional gate (Principle I) — this alias only
// affects the Vitest run, never the production build.
export {};
