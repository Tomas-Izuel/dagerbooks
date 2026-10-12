import fs from "node:fs";
import path from "node:path";
import { parse, stringify } from "yaml";
import type { ZodType } from "zod";

export function readYamlFile<T>(file: string, schema: ZodType<T>): T {
  const res = schema.safeParse(parse(fs.readFileSync(file, "utf8")));
  if (!res.success) {
    const issues = res.error.issues.map((i) => `  - ${i.path.join(".") || "(raíz)"}: ${i.message}`).join("\n");
    throw new Error(`${file}: formato inválido\n${issues}`);
  }
  return res.data;
}

export function writeYamlFile(file: string, data: unknown, header?: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const body = stringify(data, { lineWidth: 0, flowCollectionPadding: false });
  fs.writeFileSync(file, header ? `${header.replace(/^/gm, "# ")}\n\n${body}` : body);
}

export const readJson = <T>(file: string, schema: ZodType<T>): T => {
  const res = schema.safeParse(JSON.parse(fs.readFileSync(file, "utf8")));
  if (!res.success) throw new Error(`${file}: ${res.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  return res.data;
};

export const writeJson = (file: string, data: unknown) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 1) + "\n");
};
