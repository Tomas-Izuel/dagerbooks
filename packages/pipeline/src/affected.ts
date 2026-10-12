/**
 * Qué sitios cambian con un diff. Primero es determinístico (turbo + este mapa de capacidades);
 * después la skill /updates juzga si el cambio se ve para el lector.
 *
 * Un cambio en apps/<x> afecta solo a <x>. Uno en un paquete afecta a las apps que usan esa
 * capacidad: un módulo del catálogo solo a las apps que lo activan, el afiliado solo a las que
 * tienen afiliado, el formulario de sugerencias solo a las que lo usan. Tests, la pipeline y el
 * tooling no afectan a ningún sitio.
 */
export interface AppCapabilities {
  id: string;
  modules: { progression: boolean; routes: boolean; updates: boolean };
  affiliate: boolean;
  suggestions: boolean;
}

export interface AffectedApp {
  app: string;
  reasons: { file: string; capability: string }[];
}

/** Capacidad que toca un archivo, y a qué apps llega. null = no afecta a ningún sitio. */
export function capabilityOf(file: string): { capability: string; applies: (a: AppCapabilities) => boolean } | null {
  if (/(^|\/)(test|tests|__tests__)\//.test(file) || /\.test\.tsx?$/.test(file)) return null;
  const app = /^apps\/([^/]+)\//.exec(file);
  if (app) {
    // Dentro de una app: research, paridad, scripts y docs no se ven en el sitio.
    if (/^apps\/[^/]+\/(research|scripts|\.impeccable)\//.test(file) || /\.md$/.test(file)) return null;
    return { capability: "app", applies: (a) => a.id === app[1] };
  }
  const mod = /^packages\/catalog\/src\/modules\/(progression|routes|updates)\b/.exec(file);
  if (mod) return { capability: `module:${mod[1]}`, applies: (a) => a.modules[mod[1] as keyof AppCapabilities["modules"]] };
  if (/^packages\/catalog\/src\//.test(file)) return { capability: "catalog", applies: () => true };
  if (/^packages\/kit\/src\/(routes\/|react\/followedRoutes)/.test(file)) return { capability: "module:routes", applies: (a) => a.modules.routes };
  if (/^packages\/kit\/src\/react\/seenUpdate/.test(file)) return { capability: "module:updates", applies: (a) => a.modules.updates };
  if (/^packages\/kit\/src\/(suggest|server)\//.test(file)) return { capability: "suggestions", applies: (a) => a.suggestions };
  if (/^packages\/kit\/src\/affiliate/.test(file)) return { capability: "affiliate", applies: (a) => a.affiliate };
  if (/^packages\/kit\/src\//.test(file)) return { capability: "kit", applies: () => true };
  return null;
}

export function affectedApps(files: readonly string[], apps: readonly AppCapabilities[]): AffectedApp[] {
  const out = new Map<string, AffectedApp>();
  for (const file of files) {
    const cap = capabilityOf(file);
    if (!cap) continue;
    for (const a of apps.filter(cap.applies)) {
      const entry = out.get(a.id) ?? { app: a.id, reasons: [] };
      entry.reasons.push({ file, capability: cap.capability });
      out.set(a.id, entry);
    }
  }
  return [...out.values()].sort((a, b) => a.app.localeCompare(b.app));
}
