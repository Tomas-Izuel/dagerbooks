/**
 * Consultas sobre un catálogo cargado. `createQueries` recibe una función que devuelve el catálogo
 * (memoizado por la app) y arma índices perezosos. Las de prerrequisitos solo tienen sentido con
 * el módulo `progression`; sin él, las cadenas quedan vacías.
 */
import type { Book, Topic } from "./define";
import { buildAdjacency, reach } from "./graph";
import { withImplicitRootEdges } from "./modules/progression";
import type { Route } from "./modules/routes";
import type { SiteUpdate } from "./modules/updates";

interface LoadedCatalog<B extends Book<string>> {
  books: B[];
  topics: Topic[];
  root?: B;
  routes?: Route[];
  updates?: SiteUpdate[];
}

export function createQueries<B extends Book<string>>(get: () => LoadedCatalog<B>) {
  let index: { byId: Map<string, B>; topicById: Map<string, Topic>; adj: ReturnType<typeof buildAdjacency> } | undefined;
  const idx = () => {
    if (!index) {
      const { books, topics } = get();
      index = {
        byId: new Map(books.map((b) => [b.id, b])),
        topicById: new Map(topics.map((t) => [t.id, t])),
        adj: buildAdjacency(withImplicitRootEdges(books)),
      };
    }
    return index;
  };

  const pick = (ids: Iterable<string>) => [...ids].map((id) => idx().byId.get(id)!).filter(Boolean);
  const byLevelThenTitle = (a: B, b: B) => a.level - b.level || a.title.localeCompare(b.title);

  const getBooks = (): B[] => get().books;
  const getBook = (id: string): B | undefined => idx().byId.get(id);
  const getRoot = (): B => {
    const root = get().root;
    if (!root) throw new Error("getRoot: el catálogo no tiene raíz (el módulo progression no está activo)");
    return root;
  };
  const getRoutes = (): Route[] => get().routes ?? [];

  return {
    getBooks,
    getTopics: (): Topic[] => get().topics,
    getUpdates: (): SiteUpdate[] => get().updates ?? [],
    getRoutes,
    getRoute: (id: string): Route | undefined => getRoutes().find((r) => r.id === id),
    getRoot,
    getBook,
    getTopic: (id: string): Topic | undefined => idx().topicById.get(id),

    /** Libros que pertenecen al tema (primario o secundario), por nivel. */
    booksInTopic: (topicId: string): B[] => getBooks().filter((b) => b.topics.includes(topicId)).sort(byLevelThenTitle),
    /** Libros cuyo sector (tema primario) es el tema dado. */
    booksInSector: (topicId: string): B[] => getBooks().filter((b) => b.primaryTopic === topicId),

    /** Prerrequisitos directos (libros que apuntan a este). */
    directPrerequisites: (id: string): B[] => pick(idx().adj.in.get(id) ?? []),
    /** Libros que se desbloquean directamente después de este. */
    directUnlocks: (id: string): B[] => pick(idx().adj.out.get(id) ?? []),
    /** Cadena completa de prerrequisitos hasta el centro (los libros de nivel 1 cuelgan implícitamente de la raíz). */
    prerequisiteChain: (id: string): B[] => pick(reach(id, idx().adj.in)).sort(byLevelThenTitle),
    /** Todo lo que este libro desbloquea hacia afuera. */
    unlockedBy: (id: string): B[] => pick(reach(id, idx().adj.out)).sort(byLevelThenTitle),

    relatedBooks: (id: string): { book: B; reason: string }[] => {
      const b = getBook(id);
      const direct = (b?.related ?? []).map((r) => ({ book: getBook(r.id)!, reason: r.reason }));
      const inverse = getBooks().flatMap((o) =>
        (o.related ?? []).filter((r) => r.id === id && !direct.some((d) => d.book.id === o.id)).map((r) => ({ book: o, reason: r.reason })),
      );
      return [...direct, ...inverse];
    },

    /** Punto de entrada recomendado: la raíz lo enlaza explícitamente en `leadsTo`. */
    isEntryPoint: (id: string): boolean => get().root?.leadsTo?.includes(id) ?? false,

    /** Aristas implícitas raíz -> libros de nivel 1 que la raíz no enlaza explícitamente (para el renderer). */
    implicitRootEdges: (): { from: string; to: string }[] => {
      const root = get().root;
      if (!root) return [];
      const explicit = new Set(root.leadsTo ?? []);
      return getBooks()
        .filter((b) => b.level === 1 && !explicit.has(b.id))
        .map((b) => ({ from: root.id, to: b.id }));
    },
  };
}
