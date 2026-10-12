// Simple fixed-window rate limiter, kept in memory.
// On Vercel each serverless instance has its own memory, so this is a first
// line of defense only. For a hard limit shared by all instances, swap it for
// Vercel's WAF rate limiting or a store such as Upstash Redis.

type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const current = windows.get(key);

  if (!current || current.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    cleanup(now);
    return { ok: true, retryAfter: 0 };
  }

  current.count += 1;
  if (current.count > limit) {
    return { ok: false, retryAfter: Math.ceil((current.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfter: 0 };
}

// Drops expired windows so the map can't grow forever.
function cleanup(now: number) {
  if (windows.size < 1000) return;
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

export function clientIp(request: Request) {
  // Vercel sets x-forwarded-for; the first address is the client.
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}
