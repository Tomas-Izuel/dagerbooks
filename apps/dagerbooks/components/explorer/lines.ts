/** Line identity by topic id, in the sector order of content/topics.yaml. Colors come from tokens.css. */
const ORDER = [
  "fundamentos",
  "matematicas",
  "sistemas",
  "economia",
  "filosofia",
  "historia",
  "desarrollo-personal",
  "startups",
  "oficio",
  "arquitectura",
] as const;

export function lineFor(topicId: string | null): { letter: string; color: string } {
  const i = topicId ? ORDER.indexOf(topicId as (typeof ORDER)[number]) : -1;
  if (i < 0) return { letter: "0", color: "var(--porcelain-50)" };
  return { letter: String.fromCharCode(65 + i), color: `var(--line-${topicId})` };
}

export function zoneLabel(level: number): string {
  return level === 0 ? "Kilómetro 0" : `Zona ${level}`;
}
