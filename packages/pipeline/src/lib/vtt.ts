/**
 * Subtítulos automáticos de YouTube (VTT) a texto "[m:ss] línea", sin las repeticiones del
 * subtitulado progresivo. Mismo formato que las transcripciones que ya existen.
 */
export function vttToText(vtt: string): string {
  const lines: string[] = [];
  let last: string | null = null;
  for (const block of vtt.split("\n\n")) {
    const m = /(\d+):(\d+):(\d+)\.\d+ -->/.exec(block);
    if (!m) continue;
    const secs = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
    for (const raw of block.split("\n").slice(1)) {
      const t = raw.replace(/<[^>]+>/g, "").trim();
      if (t && t !== last && !t.includes("-->")) {
        lines.push(`[${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}] ${t}`);
        last = t;
      }
    }
  }
  return lines.join("\n");
}

/** De varios .vtt de un mismo video, el mejor: `<lang>-orig` > `<lang>` > el resto. */
export function bestVtt(files: string[], lang: string): string | undefined {
  const rank = (f: string) => (f.includes(`.${lang}-orig.`) ? 0 : f.includes(`.${lang}.`) ? 1 : 2);
  return [...files].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))[0];
}

/** Segmentos de Whisper ({start, text}) a "[h:mm:ss] texto". */
export function segmentsToText(segments: readonly { start: number; text: string }[]): string {
  return segments
    .map((s) => {
      const t = Math.floor(s.start);
      const h = Math.floor(t / 3600);
      const m = Math.floor((t % 3600) / 60);
      return `[${h}:${String(m).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}] ${s.text.trim()}`;
    })
    .filter((l) => !l.endsWith("] "))
    .join("\n");
}
