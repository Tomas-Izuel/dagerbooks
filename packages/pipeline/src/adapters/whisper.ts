/** Transcripción local con mlx-whisper (Apple Silicon), con el modelo turbo de large-v3. */
import fs from "node:fs";
import path from "node:path";
import { segmentsToText } from "../lib/vtt";
import { check, run } from "./exec";

export const WHISPER_MODEL = process.env.WHISPER_MODEL ?? "mlx-community/whisper-large-v3-turbo";

/** `hfHome`: caché de modelos (va en la carpeta de datos, no en el disco principal). */
export function transcribe(audioFile: string, lang: string, workDir: string, hfHome: string): string {
  fs.mkdirSync(workDir, { recursive: true });
  check(
    run("mlx_whisper", [audioFile, "--model", WHISPER_MODEL, "--language", lang, "--output-format", "json", "--output-dir", workDir], {
      uvxFrom: "mlx-whisper",
      env: { HF_HOME: hfHome },
    }),
    `mlx_whisper ${path.basename(audioFile)}`,
  );
  const json = path.join(workDir, `${path.basename(audioFile, path.extname(audioFile))}.json`);
  const data = JSON.parse(fs.readFileSync(json, "utf8")) as { segments: { start: number; text: string }[] };
  return segmentsToText(data.segments);
}
