export type RuntimeConfig = {
  port: number;
  baseUrl: string;
  apiKey: string | null;
  model: string;
  timeoutMs: number;
  corsOrigin: string;
};

type Environment = Record<string, string | undefined>;

function readEnv(env: Environment, name: string, fallback: string): string {
  const value = env[name]?.trim();
  return value || fallback;
}

export function loadRuntimeConfig(env: Environment = process.env): RuntimeConfig {
  const baseUrl = readEnv(env, "AI_BASE_URL", "https://api.deepseek.com").replace(/\/+$/, "");
  const timeoutValue = Number(env.AI_TIMEOUT_MS);
  const timeoutMs = Number.isFinite(timeoutValue) && timeoutValue > 0
    ? Math.min(120000, Math.max(1000, Math.round(timeoutValue)))
    : 30000;
  const apiKey = env.AI_API_KEY?.trim() || env.DEEPSEEK_API_KEY?.trim() || null;

  return {
    port: 8000,
    baseUrl,
    apiKey,
    model: readEnv(env, "AI_MODEL", "deepseek-chat"),
    timeoutMs,
    corsOrigin: readEnv(env, "CORS_ORIGIN", "http://localhost:8989"),
  };
}
