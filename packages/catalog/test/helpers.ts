import fs from "node:fs";
import path from "node:path";
import { stringify } from "yaml";

/** Carpeta de trabajo de los tests, dentro del paquete (en .gitignore); se corren desde la raíz del paquete. */
const WORK = path.resolve("test/.work");

let n = 0;
/** Escribe un catálogo de prueba: cada clave es un archivo (o carpeta/archivo) con su contenido. */
export function writeFixture(files: Record<string, unknown>): string {
  const dir = path.join(WORK, `${process.pid}-${++n}`);
  fs.rmSync(dir, { recursive: true, force: true });
  for (const [name, content] of Object.entries(files)) {
    const file = path.join(dir, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, typeof content === "string" ? content : stringify(content, { lineWidth: 0 }));
  }
  return dir;
}

export const book = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  title: id.replace(/-/g, " "),
  topics: ["uno"],
  level: 1,
  authors: ["Alguien"],
  summary: "Resumen.",
  context: "Contexto.",
  sources: [{ url: "https://example.com/v", stance: "recommends" }],
  ...extra,
});
