import { buildAdjacency, reach, withImplicitRootEdges } from "./graph";
import { loadCatalog } from "./load";
import type { Book, Topic } from "./schema";

interface Index {
  byId: Map<string, Book>;
  topicById: Map<string, Topic>;
  adj: ReturnType<typeof buildAdjacency>;
}
let index: Index | undefined;

function idx(): Index {
  if (!index) {
    const { books, topics } = loadCatalog();
    index = {
      byId: new Map(books.map((b) => [b.id, b])),
      topicById: new Map(topics.map((t) => [t.id, t])),
      adj: buildAdjacency(withImplicitRootEdges(books)),
    };
  }
  return index;
}

const pick = (ids: Iterable<string>) => [...ids].map((id) => idx().byId.get(id)!).filter(Boolean);
const byLevelThenTitle = (a: Book, b: Book) => a.level - b.level || a.title.localeCompare(b.title);

export const getBooks = (): Book[] => loadCatalog().books;
export const getTopics = (): Topic[] => loadCatalog().topics;
export const getRoot = (): Book => loadCatalog().root;
export const getBook = (id: string): Book | undefined => idx().byId.get(id);
export const getTopic = (id: string): Topic | undefined => idx().topicById.get(id);

/** Libros que pertenecen al tema (primario o secundario), por nivel. */
export const booksInTopic = (topicId: string): Book[] =>
  getBooks().filter((b) => b.topics.includes(topicId)).sort(byLevelThenTitle);

/** Libros cuyo sector (tema primario) es el tema dado. */
export const booksInSector = (topicId: string): Book[] =>
  getBooks().filter((b) => b.primaryTopic === topicId);

/** Prerrequisitos directos (libros que apuntan a este). */
export const directPrerequisites = (id: string): Book[] => pick(idx().adj.in.get(id) ?? []);
/** Libros que se desbloquean directamente después de este. */
export const directUnlocks = (id: string): Book[] => pick(idx().adj.out.get(id) ?? []);
/** Cadena completa de prerrequisitos hasta el centro (los libros de nivel 1 cuelgan implícitamente de la raíz). */
export const prerequisiteChain = (id: string): Book[] => pick(reach(id, idx().adj.in)).sort(byLevelThenTitle);
/** Todo lo que este libro desbloquea hacia afuera. */
export const unlockedBy = (id: string): Book[] => pick(reach(id, idx().adj.out)).sort(byLevelThenTitle);

export const relatedBooks = (id: string): { book: Book; reason: string }[] => {
  const b = getBook(id);
  const direct = (b?.related ?? []).map((r) => ({ book: getBook(r.id)!, reason: r.reason }));
  const inverse = getBooks().flatMap((o) =>
    (o.related ?? []).filter((r) => r.id === id && !direct.some((d) => d.book.id === o.id)).map((r) => ({ book: o, reason: r.reason })),
  );
  return [...direct, ...inverse];
};

/** Punto de entrada recomendado: la raíz lo enlaza explícitamente en `leadsTo`. */
export const isEntryPoint = (id: string): boolean => getRoot().leadsTo?.includes(id) ?? false;

/** Aristas implícitas raíz -> libros de nivel 1 que la raíz no enlaza explícitamente (para el renderer). */
export const implicitRootEdges = (): { from: string; to: string }[] => {
  const root = getRoot();
  const explicit = new Set(root.leadsTo ?? []);
  return getBooks()
    .filter((b) => b.level === 1 && !explicit.has(b.id))
    .map((b) => ({ from: root.id, to: b.id }));
};
