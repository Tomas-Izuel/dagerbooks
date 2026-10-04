const WORDS = [
  "cero", "una", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez",
  "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve",
  "veinte", "veintiuna", "veintidós", "veintitrés", "veinticuatro", "veinticinco", "veintiséis",
  "veintisiete", "veintiocho", "veintinueve", "treinta",
];

/** Writes a small count in Spanish words, feminine ("doce líneas", "una línea"); falls back to digits. */
export function numberInWords(n: number): string {
  return Number.isInteger(n) && n >= 0 && n < WORDS.length ? WORDS[n] : String(n);
}

/** "doce líneas" / "una línea". */
export function lineCountPhrase(n: number): string {
  return `${numberInWords(n)} ${n === 1 ? "línea" : "líneas"}`;
}
