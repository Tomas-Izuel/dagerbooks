/**
 * pipeline <comando> --creator <id> [opciones]
 *
 * Comandos (los marcados con * necesitan herramientas externas: yt-dlp, mlx_whisper, red):
 *   state                         resumen del estado de ingesta
 *   known-books                   TSV de libros del catálogo (para los prompts)
 *   registry-init                 completa el registro bibliográfico con los libros de la app
 *   import-state --legacy <dir>   importa el estado de una carpeta de research anterior
 *
 * PIPELINE_DATA_DIR cambia la carpeta de datos (por defecto <repo>/research/<creador>).
 */
import { context, type Context } from "./context";
import { importLegacyState, knownBooks, registryInit, stateSummary } from "./commands/basics";

export type Args = { _: string[]; flags: Record<string, string | true> };

export function parseArgs(argv: string[]): Args {
  const out: Args = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        out.flags[a.slice(2)] = next;
        i++;
      } else out.flags[a.slice(2)] = true;
    } else out._.push(a);
  }
  return out;
}

export const flag = (args: Args, name: string): string | undefined => {
  const v = args.flags[name];
  return typeof v === "string" ? v : undefined;
};

export const required = (args: Args, name: string): string => {
  const v = flag(args, name);
  if (!v) throw new Error(`falta --${name}`);
  return v;
};

export type Command = (ctx: Context, args: Args) => Promise<void> | void;

export const COMMANDS: Record<string, Command> = {
  state: (ctx) => stateSummary(ctx),
  "known-books": async (ctx) => console.log(await knownBooks(ctx)),
  "registry-init": async (ctx) => {
    const { written } = await registryInit(ctx);
    console.log(`registro: ${written} obra(s) escritas o completadas`);
  },
  "import-state": async (ctx, args) => {
    const state = await importLegacyState(ctx, required(args, "legacy"));
    console.log(`estado: ${state.sources.length} fuentes`);
    stateSummary(ctx);
  },
};

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const [cmd] = args._;
  const run = cmd ? COMMANDS[cmd] : undefined;
  if (!run) {
    console.error(`uso: pipeline <${Object.keys(COMMANDS).join("|")}> --creator <id> [opciones]`);
    process.exit(2);
  }
  try {
    await run(context(required(args, "creator")), args);
  } catch (e) {
    console.error(`pipeline ${cmd}: ${(e as Error).message}`);
    process.exit(1);
  }
}

if (require.main === module) void main();
