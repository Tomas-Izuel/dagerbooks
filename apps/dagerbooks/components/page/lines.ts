import { getTopics } from "@/lib/catalog/queries";
import { linesFor, type Line } from "@/lib/design/lines";

export interface LineInfo extends Line {
  name: string;
}

let cache: Map<string, LineInfo> | undefined;

/** Línea (letra, tinta, nombre) de un tema. Devuelve null para la raíz (sin tema). */
export function lineInfo(topicId: string | null | undefined): LineInfo | null {
  if (!topicId) return null;
  if (!cache) {
    const topics = getTopics();
    const names = new Map(topics.map((t) => [t.id, t.name]));
    cache = new Map(
      linesFor(topics.map((t) => t.id)).map((l) => [l.topicId, { ...l, name: names.get(l.topicId) ?? l.topicId }]),
    );
  }
  return cache.get(topicId) ?? null;
}

export const allLines = (): LineInfo[] => {
  lineInfo("x");
  return [...cache!.values()];
};
