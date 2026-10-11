import { getBook, getUpdates } from "@/lib/catalog/queries";
import { lineInfo } from "@/components/page/lines";
import type { Book, SiteUpdate } from "@/lib/catalog/schema";

/** "11 oct 2026" (la fecha del YAML es un día calendario: se formatea en UTC para no correrla). */
export function formatUpdateDate(date: string, month: "short" | "long" = "short"): string {
  return new Intl.DateTimeFormat("es-AR", { day: "numeric", month, year: "numeric", timeZone: "UTC" })
    .format(new Date(`${date}T00:00:00Z`))
    .replace(/\./g, "");
}

export interface UpdateBook {
  book: Book;
  line: { letter: string; color: string; name: string } | null;
}

/** Libros de una actualización con su línea (disco y color), en el orden del YAML. */
export function updateBooks(u: SiteUpdate): UpdateBook[] {
  return (u.books ?? []).flatMap((id) => {
    const book = getBook(id);
    if (!book) return [];
    const l = lineInfo(book.primaryTopic);
    return [{ book, line: l ? { letter: l.letter, color: l.color, name: l.name } : null }];
  });
}

export const latestUpdate = (): SiteUpdate | undefined => getUpdates()[0];

