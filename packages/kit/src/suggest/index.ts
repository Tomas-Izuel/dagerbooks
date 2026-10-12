/**
 * Sugerencias de libros desde el sitio. La lógica es pura e inyectable: la app pone la server action,
 * la detección de bots, el límite por IP y quién crea el issue. Los errores son códigos; los textos
 * los pone cada app.
 */
import { normalize } from "../search/normalize";

export interface SuggestionInput {
  title: string;
  link?: string;
  minute?: string;
  comment?: string;
}

export const SUGGESTION_LIMITS = { title: 200, link: 500, minute: 12, comment: 1000 } as const;

export type SuggestionFieldError = "required" | "too-long" | "invalid-url" | "unknown-platform" | "invalid-minute";

export type SuggestionResult =
  | { status: "created"; issue: number }
  | { status: "exists"; book: { id: string; title: string } }
  | { status: "invalid"; errors: Partial<Record<keyof SuggestionInput, SuggestionFieldError>> }
  | { status: "limited" }
  | { status: "blocked" }
  | { status: "unavailable" }
  | { status: "error" };

/** Hosts aceptados para el link, según los canales del creador. */
const PLATFORM_HOSTS: Record<string, RegExp> = {
  youtube: /(^|\.)(youtube\.com|youtu\.be)$/,
  instagram: /(^|\.)instagram\.com$/,
  twitch: /(^|\.)twitch\.tv$/,
  tiktok: /(^|\.)tiktok\.com$/,
  reddit: /(^|\.)reddit\.com$/,
  github: /(^|\.)github\.com$/,
};

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Lee y valida el formulario. `channelKinds`: plataformas del creador (decide qué links se aceptan). */
export function parseSuggestion(
  form: { get(name: string): unknown },
  channelKinds: readonly string[],
): { ok: true; input: SuggestionInput } | { ok: false; errors: Partial<Record<keyof SuggestionInput, SuggestionFieldError>> } {
  const input: SuggestionInput = { title: text(form.get("title")) };
  const link = text(form.get("link"));
  const minute = text(form.get("minute"));
  const comment = text(form.get("comment"));
  if (link) input.link = link;
  if (minute) input.minute = minute;
  if (comment) input.comment = comment;

  const errors: Partial<Record<keyof SuggestionInput, SuggestionFieldError>> = {};
  if (!input.title) errors.title = "required";
  for (const k of ["title", "link", "minute", "comment"] as const) {
    if ((input[k]?.length ?? 0) > SUGGESTION_LIMITS[k]) errors[k] = "too-long";
  }
  if (input.link && !errors.link) {
    let host = "";
    try {
      const u = new URL(input.link);
      if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error();
      host = u.hostname.replace(/^www\./, "");
    } catch {
      errors.link = "invalid-url";
    }
    // Un link de podcast puede estar en cualquier dominio; el resto, solo en las plataformas del creador.
    if (host && !channelKinds.includes("podcast") && !channelKinds.some((k) => PLATFORM_HOSTS[k]?.test(host))) errors.link = "unknown-platform";
  }
  if (input.minute && !errors.minute && !/^\d{1,2}(:\d{2}){1,2}$/.test(input.minute)) errors.minute = "invalid-minute";
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, input };
}

/** ¿Ya está en el catálogo? Compara títulos (y título en español) sin acentos ni subtítulo. */
export function createBookMatcher(books: readonly { id: string; title: string; titleEs?: string }[]) {
  const key = (s: string) => normalize(s.split(":")[0].split("(")[0]).replace(/[^\p{L}\p{N} ]/gu, "").trim();
  const index = new Map<string, { id: string; title: string }>();
  for (const b of books) for (const t of [b.title, b.titleEs]) if (t) index.set(key(t), { id: b.id, title: b.title });
  return (title: string) => index.get(key(title));
}

export interface SuggestionIssue {
  title: string;
  body: string;
  labels: string[];
}

/** Issue para el repo de sugerencias: texto legible + bloque YAML que lee /add-books. */
export function suggestionIssue(creatorId: string, input: SuggestionInput): SuggestionIssue {
  const q = (s: string) => JSON.stringify(s);
  const yaml = [
    `creator: ${creatorId}`,
    `title: ${q(input.title)}`,
    ...(input.link ? [`link: ${q(input.link)}`] : []),
    ...(input.minute ? [`minute: ${q(input.minute)}`] : []),
    ...(input.comment ? [`comment: ${q(input.comment)}`] : []),
  ].join("\n");
  const body = [
    `**Libro:** ${input.title}`,
    input.link ? `**Dónde lo recomienda:** ${input.link}${input.minute ? ` (minuto ${input.minute})` : ""}` : "**Dónde lo recomienda:** (sin link)",
    input.comment ? `**Comentario:** ${input.comment}` : "",
    "",
    "```yaml",
    yaml,
    "```",
  ]
    .filter((l, i, all) => l !== "" || all[i - 1] !== "")
    .join("\n");
  return { title: `[${creatorId}] ${input.title}`.slice(0, 250), body, labels: [`creator:${creatorId}`, "sugerencia"] };
}

export interface SuggestionDeps {
  creatorId: string;
  channelKinds: readonly string[];
  findBook: (title: string) => { id: string; title: string } | undefined;
  /** BotID u otro: true si la petición es de un bot. */
  isBot: () => Promise<boolean>;
  /** true si se puede seguir (no superó el límite). */
  allow: () => Promise<boolean>;
  /** Crea el issue y devuelve su número; null si el servicio no está configurado. */
  createIssue: ((issue: SuggestionIssue) => Promise<number>) | null;
}

export async function createSuggestion(form: { get(name: string): unknown }, deps: SuggestionDeps): Promise<SuggestionResult> {
  const parsed = parseSuggestion(form, deps.channelKinds);
  if (!parsed.ok) return { status: "invalid", errors: parsed.errors };
  const existing = deps.findBook(parsed.input.title);
  if (existing) return { status: "exists", book: existing };
  if (!deps.createIssue) return { status: "unavailable" };
  if (await deps.isBot()) return { status: "blocked" };
  if (!(await deps.allow())) return { status: "limited" };
  try {
    return { status: "created", issue: await deps.createIssue(suggestionIssue(deps.creatorId, parsed.input)) };
  } catch {
    return { status: "error" };
  }
}
