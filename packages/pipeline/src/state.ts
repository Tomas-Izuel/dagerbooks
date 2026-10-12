import fs from "node:fs";
import type { Context } from "./context";
import { readYamlFile, writeYamlFile } from "./lib/yaml-io";
import { today } from "./lib/text";
import { StateSchema, type SourceStatus, type State, type StateSource } from "./schemas";

const HEADER = `Estado de ingesta: qué fuentes se procesaron y en qué quedaron. Lo escribe la pipeline.
status: discovered | transcribed | extracted | merged | skipped`;

const EMPTY: State = { sources: [], issues: [], asrHints: {}, aliases: {} };

export function readState(ctx: Context): State {
  return fs.existsSync(ctx.statePath) ? readYamlFile(ctx.statePath, StateSchema) : structuredClone(EMPTY);
}

export function writeState(ctx: Context, state: State) {
  state.sources.sort((a, b) => a.platform.localeCompare(b.platform) || a.id.localeCompare(b.id));
  writeYamlFile(ctx.statePath, state, HEADER);
}

/** Agrega o actualiza una fuente. Nunca retrocede de estado salvo que se pida (`force`). */
export function upsertSource(state: State, src: Omit<StateSource, "at"> & { at?: string }, force = false) {
  const rank: Record<SourceStatus, number> = { discovered: 0, transcribed: 1, extracted: 2, merged: 3, skipped: 3 };
  const cur = state.sources.find((s) => s.platform === src.platform && s.id === src.id);
  if (!cur) {
    state.sources.push({ ...src, at: src.at ?? today() });
    return true;
  }
  const advance = force || rank[src.status] > rank[cur.status];
  Object.assign(cur, { ...src, status: advance ? src.status : cur.status, at: advance ? (src.at ?? today()) : cur.at });
  for (const k of Object.keys(cur) as (keyof StateSource)[]) if (cur[k] === undefined) delete cur[k];
  return advance;
}

export const byStatus = (state: State, status: SourceStatus) => state.sources.filter((s) => s.status === status);
