import { lineInfo } from "@/components/page/lines";
import { getBook } from "@/lib/catalog/queries";
import { LEVEL_LABELS, type Gap, type Route } from "@/lib/catalog/schema";
import { bookPath } from "@/lib/seo/site";

export interface JourneyQuote {
  quote?: string;
  url: string;
  timestamp?: string;
  /** Texto del link: "Escucharlo en 0:35:38", "Ver el clip" o "Ver la fuente". */
  linkLabel: string;
  /** Dónde lo dijo (título del video sin hashtags, o dominio del link). */
  where: string;
}

export interface JourneyOrder {
  url: string;
  timestamp?: string;
  quote: string;
  linkLabel: string;
}

export interface JourneyStop {
  n: number;
  id: string;
  title: string;
  titleEs?: string;
  href: string;
  level: number;
  levelLabel: string;
  /** Línea de origen del libro (disco del transbordo); null si el libro no tiene tema. */
  line: { letter: string; color: string; name: string } | null;
  /** true si la línea de origen no es la de la ruta: ahí se hace transbordo. */
  transfer: boolean;
  why: string;
  optional: boolean;
  gap?: Gap;
  quote?: JourneyQuote;
  order?: JourneyOrder;
}

const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

const isVideo = (url: string) => /(^|\.)(youtube\.com|youtu\.be)$/.test(host(url));

/** "0:35:38" o "62:14" a segundos; null si no hay o es inválido. */
function seconds(ts?: string): number | null {
  if (!ts) return null;
  const parts = ts.split(":").map(Number);
  if (parts.some((n) => !Number.isFinite(n))) return null;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

/** Mismo video o página, sin el parámetro de tiempo. */
function baseUrl(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.delete("t");
    u.hash = "";
    return u.toString();
  } catch {
    return url;
  }
}

/** Misma fuente y a menos de 30 segundos una de otra: para el lector es la misma cita. */
function sameSpot(a: { url: string; timestamp?: string }, b: { url: string; timestamp?: string }): boolean {
  if (baseUrl(a.url) !== baseUrl(b.url)) return false;
  const x = seconds(a.timestamp);
  const y = seconds(b.timestamp);
  return x === null || y === null ? x === y : Math.abs(x - y) < 30;
}

/** Texto del link a la fuente: con minuto si lo hay, si no "clip" (video) o "fuente". */
function linkLabel(url: string, timestamp?: string): string {
  const t = seconds(timestamp);
  if (timestamp && t !== null && t > 0) return `Escucharlo en ${timestamp}`;
  return isVideo(url) ? "Ver el clip" : "Ver la fuente";
}

/** Título de la fuente sin hashtags ni la cola de tags ("… MINECRAFT. #fyp #clips" -> "… MINECRAFT"). */
function cleanWhere(title: string | undefined, url: string): string {
  const clean = (title ?? "")
    .replace(/#\S+/g, "")
    .replace(/\s+/g, " ")
    .replace(/[\s.,;:·|–—-]+$/, "")
    .trim();
  return clean || host(url);
}

export interface Journey {
  stops: JourneyStop[];
  /** Orden que marcó Dager y que vale para varios pasos: se muestra una vez, en la cabecera. */
  order?: JourneyOrder;
}

/** Pasos de una ruta con todo lo que dibuja la página: libro, línea de origen, cita de Dager, tramo a pie. */
export function journey(route: Route): Journey {
  const stops: JourneyStop[] = route.steps.map((s, i) => {
    const book = getBook(s.book)!;
    const l = lineInfo(book.primaryTopic);
    const src = s.source !== undefined ? book.sources?.[s.source] : undefined;
    return {
      n: i + 1,
      id: book.id,
      title: book.title,
      titleEs: book.titleEs,
      href: bookPath(book.id),
      level: book.level,
      levelLabel: LEVEL_LABELS[book.level],
      line: l ? { letter: l.letter, color: l.color, name: l.name } : null,
      transfer: !!l && l.topicId !== route.line,
      why: s.why,
      optional: !!s.optional,
      ...(s.gap ? { gap: s.gap } : {}),
      ...(src
        ? { quote: { quote: src.quote, url: src.url, timestamp: src.timestamp, linkLabel: linkLabel(src.url, src.timestamp), where: cleanWhere(src.title, src.url) } }
        : {}),
      ...(s.order ? { order: { ...s.order, linkLabel: linkLabel(s.order.url, s.order.timestamp) } } : {}),
    };
  });

  // Un mismo orden dictado en el mismo momento vale para varios pasos: una sola vez, arriba.
  const withOrder = stops.filter((s) => s.order);
  const head = withOrder.find((s) => withOrder.filter((o) => sameSpot(o.order!, s.order!)).length > 1);
  let order: JourneyOrder | undefined;
  if (head) {
    order = head.order;
    for (const s of withOrder) if (sameSpot(s.order!, order!)) delete s.order;
  }

  // No repetir la cita: ni la de la parada anterior, ni la que ya muestra el orden de esta misma parada.
  let prevQuote: JourneyQuote | undefined;
  for (const s of stops) {
    const own = s.quote;
    if (own && ((prevQuote && sameSpot(own, prevQuote)) || (s.order && sameSpot(own, s.order)) || (order && sameSpot(own, order)))) {
      delete s.quote;
    }
    if (own) prevQuote = own;
  }
  return { stops, order };
}
