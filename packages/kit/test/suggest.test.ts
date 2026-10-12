import assert from "node:assert/strict";
import crypto from "node:crypto";
import { describe, it } from "node:test";
import { createBookMatcher, createSuggestion, parseSuggestion, suggestionIssue, type SuggestionDeps } from "../src";
import { createGithubIssueCreator, createRateLimit, githubAppFromEnv, githubAppJwt } from "../src/server";

const form = (o: Record<string, string>) => ({ get: (k: string) => o[k] ?? null });

describe("formulario", () => {
  it("valida título, link de las plataformas del creador y minuto", () => {
    assert.deepEqual(parseSuggestion(form({ title: "  " }), ["youtube"]), { ok: false, errors: { title: "required" } });
    assert.deepEqual(parseSuggestion(form({ title: "X", link: "https://example.com/v" }), ["youtube"]), { ok: false, errors: { link: "unknown-platform" } });
    assert.deepEqual(parseSuggestion(form({ title: "X", link: "nada" }), ["youtube"]), { ok: false, errors: { link: "invalid-url" } });
    assert.deepEqual(parseSuggestion(form({ title: "X", minute: "doce" }), ["youtube"]), { ok: false, errors: { minute: "invalid-minute" } });
    assert.deepEqual(parseSuggestion(form({ title: " Cosmos ", link: "https://youtu.be/abc", minute: "1:02:03" }), ["youtube"]), {
      ok: true,
      input: { title: "Cosmos", link: "https://youtu.be/abc", minute: "1:02:03" },
    });
    assert.equal(parseSuggestion(form({ title: "X", link: "https://anchor.fm/x" }), ["podcast"]).ok, true);
  });

  it("encuentra libros ya cargados por título o título en español", () => {
    const find = createBookMatcher([{ id: "meditations", title: "Meditations", titleEs: "Meditaciones" }]);
    assert.deepEqual(find("meditaciones (Gredos)"), { id: "meditations", title: "Meditations" });
    assert.deepEqual(find("MEDITATIONS: a new translation"), { id: "meditations", title: "Meditations" });
    assert.equal(find("Cosmos"), undefined);
  });

  it("arma el issue con etiquetas y un bloque YAML legible por máquina", () => {
    const issue = suggestionIssue("creador", { title: 'El "libro"', link: "https://youtu.be/x", minute: "3:10" });
    assert.equal(issue.title, '[creador] El "libro"');
    assert.deepEqual(issue.labels, ["creator:creador", "sugerencia"]);
    assert.match(issue.body, /```yaml\ncreator: creador\ntitle: "El \\"libro\\""\nlink: "https:\/\/youtu.be\/x"\nminute: "3:10"\n```/);
  });
});

describe("flujo", () => {
  const deps = (over: Partial<SuggestionDeps> = {}): SuggestionDeps => ({
    creatorId: "c",
    channelKinds: ["youtube"],
    findBook: () => undefined,
    isBot: async () => false,
    allow: async () => true,
    createIssue: async () => 42,
    ...over,
  });

  it("crea el issue, o dice por qué no", async () => {
    assert.deepEqual(await createSuggestion(form({ title: "Cosmos" }), deps()), { status: "created", issue: 42 });
    assert.deepEqual(await createSuggestion(form({ title: "Cosmos" }), deps({ findBook: () => ({ id: "cosmos", title: "Cosmos" }) })), {
      status: "exists",
      book: { id: "cosmos", title: "Cosmos" },
    });
    assert.deepEqual(await createSuggestion(form({ title: "Cosmos" }), deps({ createIssue: null })), { status: "unavailable" });
    assert.deepEqual(await createSuggestion(form({ title: "Cosmos" }), deps({ isBot: async () => true })), { status: "blocked" });
    assert.deepEqual(await createSuggestion(form({ title: "Cosmos" }), deps({ allow: async () => false })), { status: "limited" });
    assert.deepEqual(await createSuggestion(form({ title: "Cosmos" }), deps({ createIssue: async () => Promise.reject(new Error("x")) })), { status: "error" });
  });
});

describe("GitHub App y límite", () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

  it("firma un JWT RS256 verificable", () => {
    const jwt = githubAppJwt("123", pem, 1_000_000);
    const [h, p, s] = jwt.split(".");
    assert.deepEqual(JSON.parse(Buffer.from(p, "base64url").toString()), { iat: 999_940, exp: 1_000_540, iss: "123" });
    assert.ok(crypto.createVerify("RSA-SHA256").update(`${h}.${p}`).verify(publicKey, Buffer.from(s, "base64url")));
  });

  it("pide un token de instalación y crea el issue", async () => {
    const calls: string[] = [];
    const fake = (async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method} ${url}`);
      if (url.endsWith("/access_tokens")) return new Response(JSON.stringify({ token: "t", expires_at: new Date(Date.now() + 3_600_000).toISOString() }));
      assert.equal((init?.headers as Record<string, string>).Authorization, "Bearer t");
      return new Response(JSON.stringify({ number: 7 }), { status: 201 });
    }) as typeof fetch;
    const cfg = githubAppFromEnv({ GITHUB_APP_ID: "1", GITHUB_APP_PRIVATE_KEY: pem.replace(/\n/g, "\\n"), GITHUB_APP_INSTALLATION_ID: "9", SUGGESTIONS_REPO: "o/r" });
    assert.ok(cfg);
    const create = createGithubIssueCreator(cfg, fake);
    assert.equal(await create({ title: "t", body: "b", labels: [] }), 7);
    assert.equal(await create({ title: "t", body: "b", labels: [] }), 7);
    assert.deepEqual(calls, ["POST https://api.github.com/app/installations/9/access_tokens", "POST https://api.github.com/repos/o/r/issues", "POST https://api.github.com/repos/o/r/issues"]);
    assert.equal(githubAppFromEnv({}), null);
  });

  it("limita por clave en memoria y con Redis", async () => {
    const mem = createRateLimit({ limit: 2, windowSeconds: 60, prefix: "s", env: {} });
    assert.deepEqual([await mem.allow("ip"), await mem.allow("ip"), await mem.allow("ip"), await mem.allow("otra")], [true, true, false, true]);
    let n = 0;
    const redis = createRateLimit({
      limit: 1,
      windowSeconds: 60,
      prefix: "s",
      env: { UPSTASH_REDIS_REST_URL: "https://r", UPSTASH_REDIS_REST_TOKEN: "k" },
      fetchImpl: (async () => new Response(JSON.stringify([{ result: ++n }, { result: 1 }]))) as typeof fetch,
    });
    assert.deepEqual([await redis.allow("ip"), await redis.allow("ip")], [true, false]);
  });
});
