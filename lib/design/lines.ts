/**
 * Each topic is a subway line with a letter, like the Buenos Aires subte.
 * Letters follow the circular sector order of topics.yaml; colors live in
 * app/styles/tokens.css as --line-<topicId>.
 */

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"] as const;

export type LineLetter = (typeof LETTERS)[number];

export interface Line {
  topicId: string;
  letter: LineLetter;
  /** CSS custom property holding the line ink, e.g. "var(--line-economia)". */
  color: string;
}

export function linesFor(topicIds: readonly string[]): Line[] {
  if (topicIds.length > LETTERS.length) {
    throw new Error(
      `Hay ${topicIds.length} temas y solo ${LETTERS.length} líneas con letra; agregá letras y tintas en tokens.css.`,
    );
  }
  return topicIds.map((topicId, i) => ({
    topicId,
    letter: LETTERS[i],
    color: lineColor(topicId),
  }));
}

export function lineColor(topicId: string | null | undefined): string {
  return topicId ? `var(--line-${topicId})` : "var(--fg)";
}
