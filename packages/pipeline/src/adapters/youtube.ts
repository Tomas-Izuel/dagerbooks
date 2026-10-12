/** yt-dlp: listar canales, bajar subtítulos y audio. Los flags son los probados en el primer catálogo (pausas para no recibir 429). */
import { check, run } from "./exec";

export interface ListedVideo {
  id: string;
  duration?: number;
  title: string;
}

/** Salida de `--print "%(id)s\t%(duration)s\t%(title)s"`. */
export function parseFlatPlaylist(out: string): ListedVideo[] {
  return out
    .split("\n")
    .map((l) => l.split("\t"))
    .filter((p) => /^[\w-]{11}$/.test(p[0] ?? ""))
    .map(([id, dur, ...title]) => {
      const d = Number(dur);
      return { id, title: title.join("\t"), ...(Number.isFinite(d) && dur !== "NA" ? { duration: Math.round(d) } : {}) };
    });
}

/** Videos, shorts y streams de un canal (cada pestaña puede no existir). */
export function listChannel(channelUrl: string): { tab: string; videos: ListedVideo[] }[] {
  return ["videos", "shorts", "streams"].map((tab) => {
    const res = run("yt-dlp", ["--flat-playlist", "--ignore-errors", "--print", "%(id)s\t%(duration)s\t%(title)s", `${channelUrl.replace(/\/+$/, "")}/${tab}`]);
    return { tab, videos: res.status === 0 || res.stdout ? parseFlatPlaylist(res.stdout ?? "") : [] };
  });
}

export function downloadSubs(ids: string[], lang: string, outDir: string) {
  if (!ids.length) return;
  const res = run(
    "yt-dlp",
    [
      "--skip-download",
      "--write-auto-subs",
      "--sub-langs",
      `${lang}-orig,${lang}`,
      "--retry-sleep",
      "http:exp=5:120",
      "--sleep-requests",
      "1.5",
      "--sleep-subtitles",
      "2",
      "--sub-format",
      "vtt",
      "--ignore-errors",
      "-o",
      "%(id)s.%(ext)s",
      ...ids.map((id) => `https://www.youtube.com/watch?v=${id}`),
    ],
    { cwd: outDir },
  );
  // --ignore-errors: algunos videos fallan (privados, sin subtítulos) y el resto sigue.
  if (res.error) throw new Error(`yt-dlp: ${res.error.message}`);
}

export function downloadAudio(url: string, outFile: string) {
  check(run("yt-dlp", ["-x", "--audio-format", "m4a", "-o", outFile, url]), `yt-dlp audio ${url}`);
}
