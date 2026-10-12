import { spawnSync } from "node:child_process";

/** Corre un comando; si no está en el PATH prueba con `uvx` (como se hacía en research). */
export function run(cmd: string, args: string[], opts: { cwd?: string; uvxFrom?: string; env?: Record<string, string> } = {}) {
  const env = opts.env ? { ...process.env, ...opts.env } : process.env;
  const direct = spawnSync(cmd, args, { cwd: opts.cwd, env, encoding: "utf8", maxBuffer: 1 << 28 });
  if (!(direct.error && (direct.error as NodeJS.ErrnoException).code === "ENOENT")) return direct;
  const uvxArgs = opts.uvxFrom ? ["--from", opts.uvxFrom, cmd, ...args] : [cmd, ...args];
  return spawnSync("uvx", uvxArgs, { cwd: opts.cwd, env, encoding: "utf8", maxBuffer: 1 << 28 });
}

export function check(res: ReturnType<typeof run>, what: string) {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  if (res.status !== 0) throw new Error(`${what}: salió con ${res.status}\n${(res.stderr || "").slice(-2000)}`);
  return res.stdout;
}
