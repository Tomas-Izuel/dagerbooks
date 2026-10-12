/** Utilidades de texto para cruzar títulos y minutos. */

/** Minúsculas ASCII sin signos: "Atomic Habits: An Easy…" → "atomic habits an easy". */
export const normTitle = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Clave para agrupar el mismo libro: título sin subtítulo ni paréntesis. */
export const titleKey = (s: string) => normTitle(s.split(":")[0].split("(")[0]);

/** "1:02:03" o "62:14" → segundos (NaN si no es un minuto). */
export function secs(ts: string): number {
  const parts = ts.split(":").map(Number);
  if (!parts.length || parts.some((n) => !Number.isInteger(n) || n < 0)) return NaN;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

/** Segundos → "m:ss" (o "h:mm:ss" si pasa la hora). */
export function clock(total: number): string {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

export const slugify = (s: string) => normTitle(s).replace(/ /g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

export const today = () => new Date().toISOString().slice(0, 10);

/** Id de video de YouTube de una URL (watch?v=, youtu.be/, shorts/). */
export function youtubeId(url: string): string | null {
  const m = /(?:[?&]v=|youtu\.be\/|\/shorts\/|\/live\/)([\w-]{11})/.exec(url);
  return m ? m[1] : null;
}
