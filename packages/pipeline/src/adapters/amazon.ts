/**
 * Amazon: ASIN de un libro en una tienda. Port de research/amazon/az.py: primero la ficha por
 * ISBN-10, si no, la búsqueda (los candidatos los elige quien revisa). Scraping frágil: caché del
 * HTML por URL, detección de captcha y espera exponencial. Usa curl como el original.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";
const LANG: Record<string, string> = { es: "es-ES", com: "en-US", "com.mx": "es-MX", "co.uk": "en-GB", de: "de-DE", fr: "fr-FR", it: "it-IT" };
const sleep = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

const decode = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ");

export function isbn10(isbn: string): string {
  if (isbn.length === 10) return isbn.toUpperCase();
  const core = isbn.slice(3, 12);
  const sum = [...core].reduce((acc, d, k) => acc + (10 - k) * Number(d), 0);
  const ck = (11 - (sum % 11)) % 11;
  return core + (ck === 10 ? "X" : String(ck));
}

export class Amazon {
  constructor(
    private readonly marketplace: string,
    private readonly cacheDir: string,
  ) {}

  private fetch(url: string): string {
    const file = path.join(this.cacheDir, `${crypto.createHash("md5").update(url).digest("hex")}.html`);
    if (fs.existsSync(file)) return fs.readFileSync(file, "utf8");
    fs.mkdirSync(this.cacheDir, { recursive: true });
    let wait = 60_000;
    for (let i = 0; i < 4; i++) {
      sleep(2500);
      const r = spawnSync(
        "curl",
        ["-s", "--compressed", "-m", "30", "-w", "\n%{http_code}", "-A", UA, "-H", `Accept-Language: ${LANG[this.marketplace] ?? "en-US"}`, "-H", "Accept: text/html", url],
        { encoding: "utf8", maxBuffer: 1 << 26 },
      );
      const out = r.stdout ?? "";
      const cut = out.lastIndexOf("\n");
      const body = out.slice(0, cut);
      const code = out.slice(cut + 1);
      if (code === "200" && !body.slice(0, 20_000).toLowerCase().includes("captcha") && !body.slice(0, 5000).includes("api-services-support")) {
        fs.writeFileSync(file, body);
        return body;
      }
      if (code === "404") {
        fs.writeFileSync(file, "HTTP404");
        return "HTTP404";
      }
      console.warn(`  amazon: reintento (${code}) ${url}`);
      sleep(wait);
      wait *= 2;
    }
    return "";
  }

  private host = () => `https://www.amazon.${this.marketplace}`;

  /** Ficha de un ASIN o ISBN-10: título y autores si existe. */
  dp(asin: string): { asin: string; title?: string; by: string[]; ok: boolean } {
    const h = this.fetch(`${this.host()}/dp/${asin}`);
    const title = parseTitle(h);
    return { asin, ...(title ? { title } : {}), by: parseByline(h), ok: !!h && h !== "HTTP404" && !!title };
  }

  search(query: string): { asin: string; title?: string; by?: string }[] {
    return parseSearch(this.fetch(`${this.host()}/s?k=${encodeURIComponent(query).replace(/%20/g, "+")}&i=stripbooks`));
  }
}

export function parseTitle(h: string): string | undefined {
  const m = /id="productTitle"[^>]*>\s*([\s\S]*?)\s*<\/span>/.exec(h);
  return m ? decode(m[1].replace(/\s+/g, " ")) : undefined;
}

export function parseByline(h: string): string[] {
  return [...h.matchAll(/class="author[^"]*"[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/g)].map((m) => decode(m[1].trim())).slice(0, 3);
}

export function parseSearch(h: string): { asin: string; title?: string; by?: string }[] {
  const out: { asin: string; title?: string; by?: string }[] = [];
  const re = /<div[^>]*data-asin="([A-Z0-9]{10})"[^>]*data-component-type="s-search-result"[^>]*>([\s\S]*?)(?=<div[^>]*data-asin="[A-Z0-9]{10}"[^>]*data-component-type="s-search-result"|$)/g;
  for (const m of h.matchAll(re)) {
    const t = /<h2[^>]*>([\s\S]*?)<\/h2>/.exec(m[2]);
    const au = /class="a-row a-size-base a-color-secondary"[^>]*>([\s\S]*?)<\/div>/.exec(m[2]);
    out.push({
      asin: m[1],
      ...(t ? { title: decode(t[1].replace(/<[^>]+>/g, "")).trim() } : {}),
      ...(au ? { by: decode(au[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")).trim().slice(0, 80) } : {}),
    });
  }
  return out;
}
