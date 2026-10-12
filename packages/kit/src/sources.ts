/** Utilidades sobre las fuentes de una recomendación (video, post, reel) con minuto opcional. */

export const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

export const isVideo = (url: string) => /(^|\.)(youtube\.com|youtu\.be)$/.test(host(url));

/** "0:35:38" o "62:14" a segundos; null si no hay o es inválido. */
export function seconds(ts?: string): number | null {
  if (!ts) return null;
  const parts = ts.split(":").map(Number);
  if (parts.some((n) => !Number.isFinite(n))) return null;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

/** Mismo video o página, sin el parámetro de tiempo. */
export function baseUrl(url: string): string {
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
export function sameSpot(a: { url: string; timestamp?: string }, b: { url: string; timestamp?: string }): boolean {
  if (baseUrl(a.url) !== baseUrl(b.url)) return false;
  const x = seconds(a.timestamp);
  const y = seconds(b.timestamp);
  return x === null || y === null ? x === y : Math.abs(x - y) < 30;
}
