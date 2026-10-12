/**
 * @estantes/kit/server: solo servidor (usa node:crypto). Crear issues con una GitHub App y limitar
 * pedidos por clave (IP).
 */
import crypto from "node:crypto";

const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64url");

/** JWT RS256 de la GitHub App (válido 9 minutos, con 60 s de margen por relojes desfasados). */
export function githubAppJwt(appId: string, privateKeyPem: string, now = Math.floor(Date.now() / 1000)): string {
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify({ iat: now - 60, exp: now + 540, iss: appId }));
  const signature = crypto.createSign("RSA-SHA256").update(`${header}.${payload}`).sign(privateKeyPem);
  return `${header}.${payload}.${b64url(signature)}`;
}

export interface GithubAppConfig {
  appId: string;
  /** PEM; acepta "\n" escapados (como quedan en una variable de entorno). */
  privateKey: string;
  installationId: string;
  /** "owner/repo" del repo de sugerencias. */
  repo: string;
}

/** Lee la config de la GitHub App del entorno; null si falta algo (el formulario queda en "no disponible"). */
export function githubAppFromEnv(env: Record<string, string | undefined> = process.env): GithubAppConfig | null {
  const { GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, GITHUB_APP_INSTALLATION_ID, SUGGESTIONS_REPO } = env;
  if (!GITHUB_APP_ID || !GITHUB_APP_PRIVATE_KEY || !GITHUB_APP_INSTALLATION_ID || !SUGGESTIONS_REPO) return null;
  return { appId: GITHUB_APP_ID, privateKey: GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, "\n"), installationId: GITHUB_APP_INSTALLATION_ID, repo: SUGGESTIONS_REPO };
}

const GH = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "estantes-suggestions" };

export function createGithubIssueCreator(cfg: GithubAppConfig, fetchImpl: typeof fetch = fetch) {
  let token: { value: string; expires: number } | undefined;
  const installationToken = async () => {
    if (token && token.expires - Date.now() > 60_000) return token.value;
    const res = await fetchImpl(`https://api.github.com/app/installations/${cfg.installationId}/access_tokens`, {
      method: "POST",
      headers: { ...GH, Authorization: `Bearer ${githubAppJwt(cfg.appId, cfg.privateKey)}` },
    });
    if (!res.ok) throw new Error(`GitHub App: ${res.status}`);
    const data = (await res.json()) as { token: string; expires_at: string };
    token = { value: data.token, expires: Date.parse(data.expires_at) };
    return token.value;
  };
  return async (issue: { title: string; body: string; labels: string[] }): Promise<number> => {
    const res = await fetchImpl(`https://api.github.com/repos/${cfg.repo}/issues`, {
      method: "POST",
      headers: { ...GH, Authorization: `Bearer ${await installationToken()}`, "Content-Type": "application/json" },
      body: JSON.stringify(issue),
    });
    if (!res.ok) throw new Error(`GitHub issues: ${res.status}`);
    return ((await res.json()) as { number: number }).number;
  };
}

export interface RateLimit {
  /** true si la clave todavía puede hacer otro pedido en la ventana. */
  allow(key: string): Promise<boolean>;
}

/**
 * Límite fijo por ventana. Con UPSTASH_REDIS_REST_URL/TOKEN usa Redis (compartido entre instancias);
 * si no, memoria del proceso (alcanza para frenar ráfagas, no es exacto entre instancias).
 */
export function createRateLimit(opts: { limit: number; windowSeconds: number; prefix: string; env?: Record<string, string | undefined>; fetchImpl?: typeof fetch }): RateLimit {
  const env = opts.env ?? process.env;
  const url = env.UPSTASH_REDIS_REST_URL;
  const tok = env.UPSTASH_REDIS_REST_TOKEN;
  if (url && tok) {
    const f = opts.fetchImpl ?? fetch;
    return {
      async allow(key) {
        const k = `${opts.prefix}:${key}`;
        const res = await f(`${url.replace(/\/+$/, "")}/pipeline`, {
          method: "POST",
          headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
          body: JSON.stringify([
            ["INCR", k],
            ["EXPIRE", k, String(opts.windowSeconds), "NX"],
          ]),
        });
        if (!res.ok) return true; // si Redis falla, no se bloquea a nadie
        const [incr] = (await res.json()) as [{ result: number }];
        return incr.result <= opts.limit;
      },
    };
  }
  const hits = new Map<string, { count: number; reset: number }>();
  return {
    async allow(key) {
      const now = Date.now();
      const cur = hits.get(key);
      if (!cur || cur.reset <= now) {
        hits.set(key, { count: 1, reset: now + opts.windowSeconds * 1000 });
        return true;
      }
      cur.count++;
      return cur.count <= opts.limit;
    },
  };
}
